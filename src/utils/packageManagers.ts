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
 * Package-manager detection — React-free on purpose.
 *
 * The interactive parts of the auto-install flow (the confirmation prompt and
 * the streaming install log) are driven by the TUI layer through callbacks, so
 * none of the decision logic here imports React/Ink. That keeps this module
 * reusable from the build/deploy SDK surface that RevX consumes from a
 * WebContainer, which must never pull in React/Ink (see the CLI surface
 * boundaries: `src/utils/deploy/*` and `src/utils/build/*`).
 */

import { detectPackageManager, type PackageManager } from "./build/detect.js";
import { detectReferencedPackageManagers } from "./mod/packageManager.js";
import { sudo } from "./sudo.js";

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

/** yarn's official path: corepack ships with Node and activates a yarn shim. */
export function yarnInstallCommand(): string {
    return "corepack enable && corepack prepare yarn@stable --activate";
}

/**
 * bun's official standalone installer (its own runtime, no Node needed). On
 * Linux it requires `unzip` on PATH; bare containers without it surface bun's
 * own "unzip is required" error plus the manual hint.
 */
export function bunInstallCommand(): string {
    return "curl -fsSL https://bun.sh/install | bash";
}
