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

import { describe, it, expect } from "vitest";
import {
    detectProjectPackageManager,
    parsePackageManagerField,
    nodeInstallCommand,
    pnpmInstallCommand,
    yarnInstallCommand,
    bunInstallCommand,
    PM_TOOLS,
} from "./packageManagers.js";

describe("parsePackageManagerField", () => {
    it("parses a name@version field", () => {
        expect(parsePackageManagerField("pnpm@9.1.0")).toBe("pnpm");
        expect(parsePackageManagerField("yarn@4.2.2")).toBe("yarn");
        expect(parsePackageManagerField("npm@10.0.0")).toBe("npm");
        expect(parsePackageManagerField("bun@1.1.0")).toBe("bun");
    });

    it("parses a bare name with no version", () => {
        expect(parsePackageManagerField("pnpm")).toBe("pnpm");
    });

    it("returns null for unknown or malformed fields", () => {
        expect(parsePackageManagerField("deno@1.0.0")).toBeNull();
        expect(parsePackageManagerField("")).toBeNull();
        expect(parsePackageManagerField(null)).toBeNull();
    });
});

describe("detectProjectPackageManager precedence", () => {
    it("prefers the packageManager field over everything", () => {
        const pm = detectProjectPackageManager({
            packageManagerField: "yarn@4.0.0",
            lockfiles: new Set(["pnpm-lock.yaml"]),
            setupScript: "npm install",
        });
        expect(pm).toBe("yarn");
    });

    it("falls back to the lockfile when no field", () => {
        const pm = detectProjectPackageManager({
            packageManagerField: null,
            lockfiles: new Set(["pnpm-lock.yaml"]),
            setupScript: "npm install",
        });
        expect(pm).toBe("pnpm");
    });

    it("falls back to the setup.sh reference when no field or lockfile", () => {
        const pm = detectProjectPackageManager({
            packageManagerField: null,
            lockfiles: new Set(),
            setupScript: "bun install && bun run build",
        });
        expect(pm).toBe("bun");
    });

    it("defaults to npm when nothing is detectable", () => {
        const pm = detectProjectPackageManager({
            packageManagerField: null,
            lockfiles: new Set(),
            setupScript: null,
        });
        expect(pm).toBe("npm");
    });

    it("breaks setup.sh ties by MANAGERS table order, not script order", () => {
        // Script invokes pnpm first, then npm — but detectReferencedPackageManagers
        // returns table order (npm before pnpm), so the first entry wins as npm.
        const pm = detectProjectPackageManager({
            packageManagerField: null,
            lockfiles: new Set(),
            setupScript: "pnpm install || npm install",
        });
        expect(pm).toBe("npm");
    });
});

describe("install command builders", () => {
    it("installs Node via brew on macOS when brew is present", () => {
        expect(nodeInstallCommand("darwin", true)).toBe("brew install node");
    });

    it("installs Node via NodeSource on Linux (avoids ancient apt node)", () => {
        const cmd = nodeInstallCommand("linux", false);
        expect(cmd).toContain("deb.nodesource.com/setup_lts.x");
        expect(cmd).toContain("apt install -y nodejs");
    });

    it("chains the NodeSource setup and apt install (both privileged) with &&", () => {
        const cmd = nodeInstallCommand("linux", false) ?? "";
        // The setup script is piped into a privileged shell, then apt installs.
        const prefix = process.getuid?.() === 0 ? "" : "sudo ";
        expect(cmd).toContain(`| ${prefix}bash - && ${prefix}apt install -y nodejs`);
    });

    it("returns null for Node on unsupported platforms", () => {
        expect(nodeInstallCommand("win32", false)).toBeNull();
        // macOS without brew has no non-interactive path we control.
        expect(nodeInstallCommand("darwin", false)).toBeNull();
    });

    it("uses the official standalone installers for pnpm and bun", () => {
        expect(pnpmInstallCommand()).toContain("get.pnpm.io/install.sh");
        expect(bunInstallCommand()).toContain("bun.sh/install");
    });

    it("installs yarn via corepack (its official path)", () => {
        expect(yarnInstallCommand()).toContain("corepack");
        expect(yarnInstallCommand()).toContain("yarn@stable");
    });
});

describe("PM_TOOLS — which tools each PM needs", () => {
    it("npm needs only Node (npm ships with it)", () => {
        expect(PM_TOOLS.npm.map((t) => t.label)).toEqual(["Node.js"]);
    });

    it("pnpm and yarn need Node first, then themselves", () => {
        expect(PM_TOOLS.pnpm.map((t) => t.label)).toEqual(["Node.js", "pnpm"]);
        expect(PM_TOOLS.yarn.map((t) => t.label)).toEqual(["Node.js", "yarn"]);
    });

    it("bun is standalone — no Node", () => {
        expect(PM_TOOLS.bun.map((t) => t.label)).toEqual(["bun"]);
    });
});
