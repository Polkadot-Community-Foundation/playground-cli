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

import { describe, expect, it } from "vitest";
import { detectReferencedPackageManagers } from "./packageManager.js";

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
