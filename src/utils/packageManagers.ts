// Copyright (C) Parity Technologies (UK) Ltd.
// SPDX-License-Identifier: Apache-2.0

// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

/**
 * Package-manager detection and install orchestration — React-free on purpose.
 *
 * The interactive parts of the auto-install flow (the confirmation prompt and
 * the streaming install log) are driven by the TUI layer through callbacks, so
 * none of the decision logic here imports React/Ink. That keeps this module
 * reusable from the build/deploy SDK surface that RevX consumes from a
 * WebContainer, which must never pull in React/Ink (see the CLI surface
 * boundaries: `src/utils/deploy/*` and `src/utils/build/*`).
 */

import { existsSync, readFileSync } from "node:fs";
import { homedir, platform } from "node:os";
import { join, resolve } from "node:path";
import { detectPackageManager, PM_LOCKFILES_ALL, type PackageManager } from "./build/detect.js";
import { detectReferencedPackageManagers } from "./mod/packageManager.js";
import { runShell } from "./process.js";
import { sudo } from "./sudo.js";
import { commandExists, prependPath, type ToolStep } from "./toolchain.js";

export type { PackageManager };

/** Parse a package.json `packageManager` field ("pnpm@9.1.0") to a known PM. */
export function parsePackageManagerField(field: string | null): PackageManager | null {
    if (!field) return null;
    const name = field.split("@")[0]?.trim();
    if (name === "pnpm" || name === "yarn" || name === "bun" || name === "npm") return name;
    return null;
}

/** Inputs to PM detection — a filesystem-free snapshot so the choice is pure. */
export interface PmSnapshot {
    /** Raw `packageManager` field from package.json, or null. */
    packageManagerField: string | null;
    /** Lockfile basenames present in the project root. */
    lockfiles: Set<string>;
    /** Contents of setup.sh, or null when absent. */
    setupScript: string | null;
}

/**
 * Pick the PM the project uses. Precedence: packageManager field (most
 * authoritative) > lockfile > setup.sh reference > npm default.
 *
 * The setup.sh branch takes the first manager `detectReferencedPackageManagers`
 * returns — ties resolve to that helper's `MANAGERS` table order (npm, pnpm,
 * bun, yarn), not the order they appear in the script. We re-validate it through
 * `parsePackageManagerField` so this stays type-safe even if that helper ever
 * grows a `bin` outside the `PackageManager` union.
 */
export function detectProjectPackageManager(snap: PmSnapshot): PackageManager {
    const fromField = parsePackageManagerField(snap.packageManagerField);
    if (fromField) return fromField;
    if (snap.lockfiles.size > 0) return detectPackageManager(snap.lockfiles);
    if (snap.setupScript) {
        const fromScript = parsePackageManagerField(
            detectReferencedPackageManagers(snap.setupScript)[0] ?? null,
        );
        if (fromScript) return fromScript;
    }
    return "npm";
}

/**
 * Shell command to install Node.js, or null when we have no controllable
 * non-interactive path on this platform. NodeSource (not apt's `nodejs`) on
 * Linux because Debian/Ubuntu ship a years-old Node that breaks modern builds.
 */
export function nodeInstallCommand(plat: NodeJS.Platform, hasBrew: boolean): string | null {
    if (plat === "darwin" && hasBrew) return "brew install node";
    if (plat === "linux") {
        return `curl -fsSL https://deb.nodesource.com/setup_lts.x | ${sudo()}bash - && ${sudo()}apt install -y nodejs`;
    }
    return null;
}

/**
 * pnpm's official standalone installer (manages its own runtime). Note: pnpm's
 * script does not support Intel Macs (`darwin-x64`); on that host the install
 * surfaces pnpm's own error plus the manual hint rather than succeeding.
 */
export function pnpmInstallCommand(): string {
    return "curl -fsSL https://get.pnpm.io/install.sh | sh -";
}

/**
 * yarn's official path: corepack (ships with Node) writes a yarn shim. We point
 * `--install-directory` at a user-owned dir instead of corepack's default (the
 * Node bin dir), because on a NodeSource Linux install that dir is root-owned
 * and a plain `corepack enable` hits EACCES. The caller prepends `installDir`
 * to PATH so the shim resolves. Works on macOS and Linux without sudo.
 */
export function yarnInstallCommand(installDir: string): string {
    return `corepack enable --install-directory "${installDir}" && corepack prepare yarn@stable --activate`;
}

/**
 * bun's official standalone installer (its own runtime, no Node needed). On
 * Linux it requires `unzip` on PATH; bare containers without it surface bun's
 * own "unzip is required" error plus the manual hint.
 */
export function bunInstallCommand(): string {
    return "curl -fsSL https://bun.sh/install | bash";
}

/** A toolchain step plus a short label shown in the confirmation prompt. */
export interface PmTool extends ToolStep {
    /** Human label for the confirmation prompt (e.g. "Node.js", "pnpm"). */
    label: string;
}

const NODE_TOOL: PmTool = {
    name: "node",
    label: "Node.js",
    check: () => commandExists("node"),
    install: async (onData) => {
        const cmd = nodeInstallCommand(platform(), await commandExists("brew"));
        if (!cmd) {
            throw new Error(
                "Cannot install Node.js automatically on this platform — install from https://nodejs.org/en/download",
            );
        }
        await runShell(cmd, onData, { description: "install Node.js" });
    },
    manualHint: "https://nodejs.org/en/download",
};

const PNPM_TOOL: PmTool = {
    name: "pnpm",
    label: "pnpm",
    check: () => commandExists("pnpm"),
    install: async (onData) => {
        await runShell(pnpmInstallCommand(), onData, { description: "install pnpm" });
        // get.pnpm.io writes PNPM_HOME and edits shell rc files, but those edits
        // don't reach the running process. Expose the bin dir now so the very
        // next step can resolve `pnpm`. The installer's default PNPM_HOME is
        // platform-specific: ~/Library/pnpm on macOS, ~/.local/share/pnpm on Linux.
        const pnpmHome =
            platform() === "darwin"
                ? resolve(homedir(), "Library/pnpm")
                : resolve(homedir(), ".local/share/pnpm");
        prependPath(process.env.PNPM_HOME ?? pnpmHome);
    },
    manualHint: "https://pnpm.io/installation",
};

const YARN_TOOL: PmTool = {
    name: "yarn",
    label: "yarn",
    check: () => commandExists("yarn"),
    install: async (onData) => {
        const binDir = resolve(homedir(), ".corepack/bin");
        await runShell(yarnInstallCommand(binDir), onData, { description: "install yarn" });
        // corepack wrote the yarn shim into our user-owned --install-directory
        // (avoids EACCES on a root-owned NodeSource bin dir); expose it now so the
        // very next step resolves `yarn`.
        prependPath(binDir);
    },
    manualHint: "https://yarnpkg.com/getting-started/install",
};

const BUN_TOOL: PmTool = {
    name: "bun",
    label: "bun",
    check: () => commandExists("bun"),
    install: async (onData) => {
        await runShell(bunInstallCommand(), onData, { description: "install bun" });
        // bun's installer writes the binary to $BUN_INSTALL/bin (default ~/.bun),
        // and edits shell rc files that don't reach the running process. Honor
        // BUN_INSTALL (the installer does) and expose the bin dir now.
        prependPath(resolve(process.env.BUN_INSTALL ?? resolve(homedir(), ".bun"), "bin"));
    },
    manualHint: "https://bun.sh/docs/installation",
};

/**
 * Ordered list of tools to ensure for each PM. Order matters: Node must be
 * present before yarn (corepack ships with Node) and before pnpm (build scripts
 * call `node`). bun is its own runtime and needs nothing else.
 */
export const PM_TOOLS: Record<PackageManager, PmTool[]> = {
    npm: [NODE_TOOL],
    pnpm: [NODE_TOOL, PNPM_TOOL],
    yarn: [NODE_TOOL, YARN_TOOL],
    bun: [BUN_TOOL],
};

/** What `ensurePackageManager` will install, shown to the user before it does. */
export interface InstallPlan {
    pm: PackageManager;
    /** Labels of the tools that are missing and will be installed. */
    toolsToInstall: string[];
}

export interface EnsurePackageManagerOptions {
    /** Per-line install output sink. */
    onData?: (line: string) => void;
    /**
     * Asked once before installing, with the plan. Return true to proceed.
     * Omitted → auto-proceed (the non-interactive posture).
     */
    confirm?: (plan: InstallPlan) => Promise<boolean>;
}

/**
 * Thrown when the user declines the install at the confirmation prompt. Carries
 * the manual-install hint as its message. This is a SOFT outcome — callers
 * render it as a gentle "install it yourself" notice, not an error row.
 *
 * Install-time failures (a curl/apt step exiting non-zero) and the
 * unsupported-platform case are NOT this class: a tool's `install()` rejects
 * with a plain Error carrying the captured log / manual hint, which callers
 * surface as a hard failure. Keep the two paths distinct.
 */
export class PackageManagerUnavailableError extends Error {
    constructor(message: string) {
        super(message);
        this.name = "PackageManagerUnavailableError";
    }
}

// Process-wide single-flight for installs, keyed by tool name. `deploy-all`
// runs builds for several apps concurrently in ONE process; when they share a
// missing PM, every worker would otherwise launch the same installer at once
// (two `get.pnpm.io | sh` runs, or racing `sudo apt`/`dpkg` locks). Collapsing
// concurrent installs of the same tool onto one promise makes that safe.
const inFlightInstalls = new Map<string, Promise<void>>();

function installOnce(tool: PmTool, onData?: (line: string) => void): Promise<void> {
    const existing = inFlightInstalls.get(tool.name);
    if (existing) return existing;
    const p = Promise.resolve(tool.install(onData)).finally(() => {
        inFlightInstalls.delete(tool.name);
    });
    inFlightInstalls.set(tool.name, p);
    return p;
}

/** Core orchestration, parameterized on the tool list so it is trivially testable. */
export async function ensurePackageManagerForTools(
    pm: PackageManager,
    tools: PmTool[],
    opts: EnsurePackageManagerOptions,
): Promise<PackageManager> {
    const missing: PmTool[] = [];
    for (const tool of tools) {
        if (!(await tool.check())) missing.push(tool);
    }
    if (missing.length === 0) return pm;

    const plan: InstallPlan = { pm, toolsToInstall: missing.map((t) => t.label) };
    const proceed = opts.confirm ? await opts.confirm(plan) : true;
    if (!proceed) {
        throw new PackageManagerUnavailableError(packageManagerManualHint(pm, missing));
    }

    for (const tool of missing) {
        opts.onData?.(`> installing ${tool.label}`);
        await installOnce(tool, opts.onData);
    }

    // Re-verify: an installer can exit 0 yet leave the binary off the running
    // process's PATH (e.g. a prependPath target that doesn't match where the
    // installer actually wrote). Surface that here with the manual hint, instead
    // of letting the next build/setup step die with a confusing "command not
    // found" — the exact scary-error class this whole flow exists to kill.
    const stillMissing: PmTool[] = [];
    for (const tool of missing) {
        if (!(await tool.check())) stillMissing.push(tool);
    }
    if (stillMissing.length > 0) {
        const names = stillMissing.map((t) => t.label).join(", ");
        throw new Error(
            `Installed ${names} but it is still not on PATH. ${packageManagerManualHint(pm, stillMissing)}`,
        );
    }
    return pm;
}

/** Compute the install plan (which tools are missing) without installing. */
export async function planPackageManagerForTools(
    pm: PackageManager,
    tools: PmTool[],
): Promise<InstallPlan> {
    const toolsToInstall: string[] = [];
    for (const tool of tools) {
        if (!(await tool.check())) toolsToInstall.push(tool.label);
    }
    return { pm, toolsToInstall };
}

/** Disk-backed variant: detect the PM and report its install plan. */
export async function planPackageManager(projectDir: string): Promise<InstallPlan> {
    const pm = detectProjectPackageManager(loadPackageManagerSnapshot(projectDir));
    return planPackageManagerForTools(pm, PM_TOOLS[pm]);
}

/** Copy-paste manual instructions when we won't / can't auto-install. */
export function packageManagerManualHint(pm: PackageManager, tools: PmTool[]): string {
    const hints = tools.map((t) => `${t.label}: ${t.manualHint ?? "(see official docs)"}`);
    return `This project uses ${pm}. Install it manually, then re-run:\n${hints.join("\n")}`;
}

/** Read the PM-detection snapshot from a project directory. */
export function loadPackageManagerSnapshot(projectDir: string): PmSnapshot {
    const pkgPath = join(projectDir, "package.json");
    let packageManagerField: string | null = null;
    if (existsSync(pkgPath)) {
        try {
            const pkg = JSON.parse(readFileSync(pkgPath, "utf8")) as { packageManager?: string };
            packageManagerField = pkg.packageManager ?? null;
        } catch {
            // Unreadable/malformed package.json — fall through to lockfile/script.
            // Detection degrades gracefully here on purpose; contrast
            // build/runner.ts::loadDetectInput, which parses unguarded so a
            // broken manifest fails the build loudly.
        }
    }
    const lockfiles = new Set<string>();
    for (const name of PM_LOCKFILES_ALL) {
        if (existsSync(join(projectDir, name))) lockfiles.add(name);
    }
    const setupPath = join(projectDir, "setup.sh");
    const setupScript = existsSync(setupPath) ? readFileSync(setupPath, "utf8") : null;
    return { packageManagerField, lockfiles, setupScript };
}

/**
 * Public entry point: detect the project's PM from disk and ensure it (and Node
 * when required) is installed. Throws PackageManagerUnavailableError when the
 * user declines the prompt (a soft outcome); rejects with a plain Error
 * carrying the captured install log when an install step fails or the platform
 * is unsupported.
 */
export async function ensurePackageManager(
    projectDir: string,
    opts: EnsurePackageManagerOptions = {},
): Promise<PackageManager> {
    const snapshot = loadPackageManagerSnapshot(projectDir);
    const pm = detectProjectPackageManager(snapshot);
    return ensurePackageManagerForTools(pm, PM_TOOLS[pm], opts);
}
