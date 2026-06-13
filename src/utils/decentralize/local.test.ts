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

import { mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { findProjectRoot, InvalidLocalPathError, prepareLocalDirectory } from "./local.js";

describe("prepareLocalDirectory", () => {
    const tempDirs: string[] = [];

    function makeTempDir(): string {
        const dir = mkdtempSync(join(tmpdir(), "dot-local-test-"));
        tempDirs.push(dir);
        return dir;
    }

    afterEach(() => {
        for (const dir of tempDirs.splice(0)) {
            rmSync(dir, { recursive: true, force: true });
        }
    });

    it("rejects a missing path", () => {
        expect(() => prepareLocalDirectory("/tmp/dot-local-test-does-not-exist")).toThrow(
            InvalidLocalPathError,
        );
        expect(() => prepareLocalDirectory("/tmp/dot-local-test-does-not-exist")).toThrow(
            /directory not found/,
        );
    });

    it("rejects a path pointing at a file", () => {
        const dir = makeTempDir();
        const file = join(dir, "index.html");
        writeFileSync(file, "<html></html>");
        expect(() => prepareLocalDirectory(file)).toThrow(/not a directory/);
    });

    it("rejects a directory with no index.html anywhere", () => {
        const dir = makeTempDir();
        writeFileSync(join(dir, "main.js"), "console.log(1)");
        expect(() => prepareLocalDirectory(dir)).toThrow(/no index\.html found/);
    });

    it("uses the directory itself when index.html sits at the root", () => {
        const dir = makeTempDir();
        writeFileSync(join(dir, "index.html"), "<html></html>");
        writeFileSync(join(dir, "app.js"), "console.log(1)");
        mkdirSync(join(dir, "assets"));
        writeFileSync(join(dir, "assets", "style.css"), "body{}");

        const result = prepareLocalDirectory(dir);
        expect(result.uploadRoot).toBe(dir);
        expect(result.fileCount).toBe(3);
    });

    it("descends to the shallowest index.html so it lands at the upload root", () => {
        // Mirrors `findIndexHtmlRoot`'s contract from the wget flow: Bulletin's
        // renderer needs index.html at the top level of the uploaded tree.
        const dir = makeTempDir();
        const nested = join(dir, "site");
        mkdirSync(nested);
        writeFileSync(join(nested, "index.html"), "<html></html>");

        const result = prepareLocalDirectory(dir);
        expect(result.uploadRoot).toBe(nested);
        expect(result.fileCount).toBe(1);
    });

    it("resolves a relative path to an absolute upload root", () => {
        const dir = makeTempDir();
        writeFileSync(join(dir, "index.html"), "<html></html>");
        const previousCwd = process.cwd();
        try {
            process.chdir(dir);
            const result = prepareLocalDirectory(".");
            // Compare against process.cwd() rather than `dir`: chdir resolves
            // the macOS tmpdir symlink (/var → /private/var) and `resolve(".")`
            // builds on cwd, so the two always agree while `dir` may not.
            expect(result.uploadRoot).toBe(process.cwd());
            expect(result.fileCount).toBe(1);
        } finally {
            process.chdir(previousCwd);
        }
    });
});

describe("findProjectRoot", () => {
    const tempDirs: string[] = [];

    function makeTempDir(): string {
        // realpathSync collapses the macOS /var → /private/var symlink so the
        // returned root matches `findProjectRoot`'s `resolve()`-based output.
        const dir = realpathSync(mkdtempSync(join(tmpdir(), "dot-projroot-test-")));
        tempDirs.push(dir);
        return dir;
    }

    afterEach(() => {
        for (const dir of tempDirs.splice(0)) {
            rmSync(dir, { recursive: true, force: true });
        }
    });

    it("returns the directory itself when it contains a .git", () => {
        const dir = makeTempDir();
        mkdirSync(join(dir, ".git"));
        expect(findProjectRoot(dir)).toBe(dir);
    });

    it("walks up to the repo root from a build subdirectory (e.g. ./dist)", () => {
        // The common case: --path points at the build output, the README and
        // .git live one level up at the project root.
        const root = makeTempDir();
        mkdirSync(join(root, ".git"));
        const dist = join(root, "dist");
        mkdirSync(dist);
        expect(findProjectRoot(dist)).toBe(root);
    });

    it("treats a .git FILE (linked worktree) as a repo root", () => {
        const dir = makeTempDir();
        writeFileSync(join(dir, ".git"), "gitdir: /elsewhere/.git/worktrees/x");
        expect(findProjectRoot(dir)).toBe(dir);
    });

    it("falls back to the resolved directory when no .git ancestor exists", () => {
        const dir = makeTempDir();
        const nested = join(dir, "a", "b");
        mkdirSync(nested, { recursive: true });
        expect(findProjectRoot(nested)).toBe(nested);
    });
});
