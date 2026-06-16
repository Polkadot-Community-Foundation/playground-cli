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
 * Pure build-config detection — given a project tree snapshot, decide which
 * command to run and where the output will land. No I/O here so unit tests
 * stay trivial; the caller is responsible for reading package.json and
 * listing lockfiles.
 */

import { DEFAULT_BUILD_DIR } from "../../config.js";

export type PackageManager = "pnpm" | "yarn" | "bun" | "npm";

/** Canonical lockfile basename per package manager. */
export const PM_LOCKFILES: Record<PackageManager, string> = {
    pnpm: "pnpm-lock.yaml",
    yarn: "yarn.lock",
    bun: "bun.lockb",
    npm: "package-lock.json",
};

// Bun 1.2+ defaults to a TEXT lockfile (`bun.lock`); older bun wrote the binary
// `bun.lockb`. Detect either so modern bun projects aren't mis-detected as npm.
const BUN_TEXT_LOCKFILE = "bun.lock";

/** Every lockfile basename to probe on disk (some PMs have more than one). */
export const PM_LOCKFILES_ALL: string[] = [...Object.values(PM_LOCKFILES), BUN_TEXT_LOCKFILE];

export interface BuildConfig {
    /** Binary + args to spawn. */
    cmd: string;
    args: string[];
    /** Human-readable description of which route we took ("pnpm run build", "npx vite build", …). */
    description: string;
    /** Best guess at where the built artifacts will land, relative to the project root. */
    defaultOutputDir: string;
}

export interface InstallConfig {
    /** Binary + args to spawn. */
    cmd: string;
    args: string[];
    /** Human-readable description ("npm install", "pnpm install", …). */
    description: string;
}

export interface DetectInput {
    /** Parsed package.json contents (object after JSON.parse), or null if missing. */
    packageJson: {
        scripts?: Record<string, string>;
        dependencies?: Record<string, string>;
        devDependencies?: Record<string, string>;
    } | null;
    /** Set of lockfile basenames that exist in the project root. */
    lockfiles: Set<string>;
    /** Set of additional config-file basenames (e.g. vite.config.ts). */
    configFiles: Set<string>;
    /**
     * Absolute project root the snapshot was taken from, used only to name the
     * directory in the missing-package.json error. Optional so unit tests can
     * build inputs without a real path.
     */
    projectDir?: string;
}

export class BuildDetectError extends Error {
    constructor(message: string) {
        super(message);
        this.name = "BuildDetectError";
    }
}

/** Pick a package manager from the lockfiles present. Defaults to npm. */
export function detectPackageManager(lockfiles: Set<string>): PackageManager {
    if (lockfiles.has(PM_LOCKFILES.pnpm)) return "pnpm";
    if (lockfiles.has(PM_LOCKFILES.yarn)) return "yarn";
    if (lockfiles.has(PM_LOCKFILES.bun) || lockfiles.has(BUN_TEXT_LOCKFILE)) return "bun";
    return "npm";
}

/** Frameworks we can invoke directly (via the PM's exec runner) if no `build` script is defined. */
const FRAMEWORK_HINTS: Array<{
    name: string;
    matches: (input: DetectInput) => boolean;
    /** Command forwarded to the PM's `exec` / `dlx` runner. */
    execCommand: string[];
    defaultOutputDir: string;
}> = [
    {
        name: "vite",
        matches: (i) =>
            i.configFiles.has("vite.config.ts") ||
            i.configFiles.has("vite.config.js") ||
            i.configFiles.has("vite.config.mjs") ||
            hasDep(i.packageJson, "vite"),
        execCommand: ["vite", "build"],
        defaultOutputDir: "dist",
    },
    {
        name: "next",
        matches: (i) =>
            i.configFiles.has("next.config.js") ||
            i.configFiles.has("next.config.mjs") ||
            i.configFiles.has("next.config.ts") ||
            hasDep(i.packageJson, "next"),
        execCommand: ["next", "build"],
        defaultOutputDir: ".next",
    },
    {
        name: "tsc",
        matches: (i) => i.configFiles.has("tsconfig.json") && hasDep(i.packageJson, "typescript"),
        execCommand: ["tsc", "-p", "tsconfig.json"],
        defaultOutputDir: DEFAULT_BUILD_DIR,
    },
];

function hasDep(pkg: DetectInput["packageJson"], name: string): boolean {
    if (!pkg) return false;
    return Boolean(pkg.dependencies?.[name] ?? pkg.devDependencies?.[name]);
}

const PM_RUN: Record<PackageManager, string[]> = {
    pnpm: ["pnpm", "run"],
    yarn: ["yarn", "run"],
    bun: ["bun", "run"],
    npm: ["npm", "run"],
};

const PM_EXEC: Record<PackageManager, string[]> = {
    pnpm: ["pnpm", "exec"],
    yarn: ["yarn"],
    bun: ["bunx"],
    npm: ["npx"],
};

const PM_INSTALL: Record<PackageManager, InstallConfig> = {
    pnpm: { cmd: "pnpm", args: ["install"], description: "pnpm install" },
    yarn: { cmd: "yarn", args: ["install"], description: "yarn install" },
    bun: { cmd: "bun", args: ["install"], description: "bun install" },
    npm: { cmd: "npm", args: ["install"], description: "npm install" },
};

/**
 * Decide whether we need to run an install step before building. Returns the
 * install command whenever the project declares any dependencies, otherwise
 * null.
 *
 * We install unconditionally (not just when node_modules/ is missing) because
 * a stale node_modules/ — e.g. after a branch switch or a teammate bumping the
 * lockfile — bypasses the missing-folder guard and lets the build run against
 * package versions that don't match the lockfile. The resulting "X is not
 * exported by Y" error from Vite/Rollup is opaque and the user has no signal
 * that the fix is a re-install. pnpm/yarn/npm are all idempotent when in sync
 * (~1s no-op), so the cost is negligible. Skipping install for a deps-free
 * package.json is still safe: there's nothing to install.
 */
export function detectInstallConfig(input: DetectInput): InstallConfig | null {
    const pkg = input.packageJson;
    if (!pkg) return null;
    const depCount =
        Object.keys(pkg.dependencies ?? {}).length + Object.keys(pkg.devDependencies ?? {}).length;
    if (depCount === 0) return null;
    return PM_INSTALL[detectPackageManager(input.lockfiles)];
}

/**
 * Pick a build command given the detected project state.
 *
 * Preference order:
 *   1. An explicit `build` npm script, invoked through the detected PM.
 *   2. A known framework (vite / next / tsc), invoked through the PM's exec runner.
 *   3. Throw — we don't know how to build.
 */
export function detectBuildConfig(input: DetectInput): BuildConfig {
    const pm = detectPackageManager(input.lockfiles);
    const buildScript = input.packageJson?.scripts?.build;

    if (buildScript) {
        const [cmd, ...args] = PM_RUN[pm];
        return {
            cmd,
            args: [...args, "build"],
            description: `${pm} run build`,
            defaultOutputDir: inferOutputDirFromScript(buildScript) ?? DEFAULT_BUILD_DIR,
        };
    }

    for (const hint of FRAMEWORK_HINTS) {
        if (hint.matches(input)) {
            const [cmd, ...args] = PM_EXEC[pm];
            return {
                cmd,
                args: [...args, ...hint.execCommand],
                description: `${pm} exec ${hint.execCommand.join(" ")}`,
                defaultOutputDir: hint.defaultOutputDir,
            };
        }
    }

    // No package.json at all almost always means the user is a level above
    // their project (e.g. ran `dot mod`, then `dot build` from the parent dir).
    // Point them at the directory rather than at editing a package.json that
    // isn't there — the generic "add a build script" message sends them to the
    // wrong fix.
    if (!input.packageJson) {
        const where = input.projectDir ? ` in ${input.projectDir}` : "";
        throw new BuildDetectError(
            `No package.json found${where}. Are you in your project directory? ` +
                "cd into it first, or point the command at it with --dir <path>.",
        );
    }

    throw new BuildDetectError(
        'No build strategy detected. Add a "build" script to package.json, or install vite/next/typescript.',
    );
}

/** Cheap heuristic: if the build script mentions a known tool, guess its default output dir. */
function inferOutputDirFromScript(script: string): string | null {
    if (/\bnext\b/.test(script)) return ".next";
    if (/\bvite\b/.test(script)) return "dist";
    if (/\btsc\b/.test(script)) return DEFAULT_BUILD_DIR;
    return null;
}
