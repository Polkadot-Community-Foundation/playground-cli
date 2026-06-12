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

import { beforeEach, describe, expect, it, vi } from "vitest";
import { commandExists } from "../toolchain.js";
import {
    detectReferencedPackageManagers,
    findUnsatisfiedPackageManagers,
    missingPackageManagerMessage,
} from "./packageManager.js";

vi.mock("../toolchain.js", () => ({ commandExists: vi.fn() }));
const mockCommandExists = vi.mocked(commandExists);

describe("detectReferencedPackageManagers", () => {
    it("detects npm and npx", () => {
        expect(detectReferencedPackageManagers("npm install")).toEqual(["npm"]);
        expect(detectReferencedPackageManagers("npx vite build")).toEqual(["npm"]);
    });

    it("detects pnpm and pnpx", () => {
        expect(detectReferencedPackageManagers("pnpm i")).toEqual(["pnpm"]);
        expect(detectReferencedPackageManagers("pnpx tsc")).toEqual(["pnpm"]);
    });

    it("detects bun and bunx", () => {
        expect(detectReferencedPackageManagers("bun install")).toEqual(["bun"]);
        expect(detectReferencedPackageManagers("bunx vite")).toEqual(["bun"]);
    });

    it("detects yarn and yarnpkg", () => {
        expect(detectReferencedPackageManagers("yarn install")).toEqual(["yarn"]);
        expect(detectReferencedPackageManagers("yarnpkg add foo")).toEqual(["yarn"]);
    });

    it("detects multiple managers in one script", () => {
        expect(detectReferencedPackageManagers("npm ci\nbun run build")).toEqual(["npm", "bun"]);
    });

    it("matches when the command follows a shell operator", () => {
        expect(detectReferencedPackageManagers("cd app && pnpm install")).toEqual(["pnpm"]);
        expect(detectReferencedPackageManagers("(npm run build)")).toEqual(["npm"]);
    });

    it("does not match substrings of other words", () => {
        expect(detectReferencedPackageManagers("echo npmrc")).toEqual([]);
        expect(detectReferencedPackageManagers("./bundle.sh")).toEqual([]);
        expect(detectReferencedPackageManagers("run-pnpm-thing")).toEqual([]);
        expect(detectReferencedPackageManagers("echo yarnball")).toEqual([]);
    });

    it("ignores comments", () => {
        expect(detectReferencedPackageManagers("# install with npm\necho hi")).toEqual([]);
    });

    it("ignores occurrences inside string literals", () => {
        expect(detectReferencedPackageManagers('echo "use npm to install"')).toEqual([]);
        expect(detectReferencedPackageManagers("echo 'pnpm is nice'")).toEqual([]);
    });

    it("returns empty for scripts with no package manager", () => {
        expect(detectReferencedPackageManagers("make build")).toEqual([]);
    });
});

describe("findUnsatisfiedPackageManagers", () => {
    beforeEach(() => mockCommandExists.mockReset());

    it("returns empty when the script needs no package manager", async () => {
        await expect(findUnsatisfiedPackageManagers("make build")).resolves.toEqual([]);
        expect(mockCommandExists).not.toHaveBeenCalled();
    });

    it("returns empty when the single required manager is installed", async () => {
        mockCommandExists.mockResolvedValue(true);
        await expect(findUnsatisfiedPackageManagers("npm install")).resolves.toEqual([]);
    });

    it("flags the manager when it is the only one referenced and is missing", async () => {
        mockCommandExists.mockResolvedValue(false);
        await expect(findUnsatisfiedPackageManagers("npm install")).resolves.toEqual(["npm"]);
    });

    it("flags yarn when a yarn-only script has no yarn installed", async () => {
        mockCommandExists.mockResolvedValue(false);
        await expect(findUnsatisfiedPackageManagers("yarn install")).resolves.toEqual(["yarn"]);
    });

    it("is satisfied when ANY referenced manager from a fallback chain is present", async () => {
        // setup.sh tries bun, else pnpm, else npm; only npm installed -> fine.
        mockCommandExists.mockImplementation(async (bin: string) => bin === "npm");
        const script =
            "if command -v bun; then bun i; elif command -v pnpm; then pnpm i; else npm i; fi";
        await expect(findUnsatisfiedPackageManagers(script)).resolves.toEqual([]);
    });

    it("flags all referenced managers only when none are installed", async () => {
        mockCommandExists.mockResolvedValue(false);
        const script =
            "if command -v bun; then bun i; elif command -v pnpm; then pnpm i; else npm i; fi";
        await expect(findUnsatisfiedPackageManagers(script)).resolves.toEqual([
            "npm",
            "pnpm",
            "bun",
        ]);
    });

    it("short-circuits once a present manager is found", async () => {
        mockCommandExists.mockResolvedValue(true);
        await findUnsatisfiedPackageManagers("npm i\npnpm i\nbun i");
        expect(mockCommandExists).toHaveBeenCalledTimes(1);
    });
});

describe("missingPackageManagerMessage", () => {
    it("points npm users at Node.js", () => {
        const msg = missingPackageManagerMessage(["npm"]);
        expect(msg).toContain("npm");
        expect(msg).toContain("none is installed");
        expect(msg).toContain("nodejs.org");
    });

    it("uses a generic install hint for a single non-npm manager", () => {
        const msg = missingPackageManagerMessage(["bun"]);
        expect(msg).toContain("bun");
        expect(msg).toContain("Install bun");
        expect(msg).not.toContain("nodejs.org");
    });

    it("phrases a fallback chain as 'one of'", () => {
        const msg = missingPackageManagerMessage(["npm", "pnpm", "bun"]);
        expect(msg).toContain("one of: npm, pnpm, bun");
        expect(msg).toContain("none is installed");
    });
});
