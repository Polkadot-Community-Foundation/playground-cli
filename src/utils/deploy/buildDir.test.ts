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

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import { assertBuildDirExists } from "./buildDir.js";

describe("assertBuildDirExists", () => {
    let root: string;

    beforeEach(() => {
        root = mkdtempSync(join(tmpdir(), "builddir-test-"));
    });

    afterEach(() => {
        rmSync(root, { recursive: true, force: true });
    });

    it("does not throw when the build directory exists", () => {
        mkdirSync(join(root, "dist"));
        expect(() => assertBuildDirExists(root, "dist")).not.toThrow();
    });

    it("throws with the resolved absolute path when the directory is missing", () => {
        expect(() => assertBuildDirExists(root, "dist")).toThrow(
            new RegExp(`Build directory not found: ${resolve(root, "dist")}`),
        );
    });

    it("throws when the build path exists but is a file, not a directory", () => {
        writeFileSync(join(root, "dist"), "not a dir");
        expect(() => assertBuildDirExists(root, "dist")).toThrow(/not a directory/);
    });

    it("resolves a relative buildDir against projectDir", () => {
        // The directory exists under projectDir, but NOT under process.cwd(),
        // so a check that resolved against cwd would wrongly fail.
        mkdirSync(join(root, "build", "out"), { recursive: true });
        expect(() => assertBuildDirExists(root, "build/out")).not.toThrow();
    });

    it("honours an absolute buildDir", () => {
        const abs = join(root, "artifacts");
        mkdirSync(abs);
        // projectDir is irrelevant when buildDir is absolute.
        expect(() => assertBuildDirExists("/some/other/root", abs)).not.toThrow();
    });
});
