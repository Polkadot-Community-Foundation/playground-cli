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
import { detectProjectPackageManager, parsePackageManagerField } from "./packageManagers.js";

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
