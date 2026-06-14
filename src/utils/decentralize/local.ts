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
 * Prepare an already-on-disk static site for `dot decentralize --path <dir>`.
 *
 * The local-path flow skips `mirrorSite` (no wget) and enters the pipeline at
 * the same seam the URL flow does: a directory handed to `runStorageDeploy`.
 * This module owns the validation between "user typed a path" and that seam.
 *
 * No React/Ink imports — `src/utils/decentralize/*` is part of the SDK
 * surface RevX consumes from a WebContainer.
 */

import { existsSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { countFiles, findIndexHtmlRoot } from "./mirror.js";

export class InvalidLocalPathError extends Error {
    constructor(message: string) {
        super(message);
        this.name = "InvalidLocalPathError";
    }
}

export interface LocalSiteResult {
    /**
     * Parent of the shallowest `index.html` under the given directory — the
     * directory to upload, so Bulletin's renderer sees `index.html` at the
     * top level (same rule as `findIndexHtmlRoot` in the mirror flow).
     */
    uploadRoot: string;
    fileCount: number;
}

/**
 * Resolve and validate a local directory as an uploadable static site.
 * Throws `InvalidLocalPathError` with an actionable message when the path is
 * missing, not a directory, or contains no `index.html` anywhere.
 */
export function prepareLocalDirectory(path: string): LocalSiteResult {
    const abs = resolve(path);

    let stat;
    try {
        stat = statSync(abs);
    } catch {
        throw new InvalidLocalPathError(`directory not found: ${abs}`);
    }
    if (!stat.isDirectory()) {
        throw new InvalidLocalPathError(
            `not a directory: ${abs} — point --path at a built static site directory, e.g. ./dist`,
        );
    }

    const uploadRoot = findIndexHtmlRoot(abs);
    if (!uploadRoot) {
        throw new InvalidLocalPathError(
            `no index.html found under ${abs} — point --path at a built static site, e.g. ./dist`,
        );
    }

    return { uploadRoot, fileCount: countFiles(uploadRoot) };
}

/**
 * Walk up from `startDir` to the enclosing git repository root (the first
 * ancestor — or `startDir` itself — containing a `.git` entry). Falls back to
 * the resolved `startDir` when no `.git` is found.
 *
 * `--path` typically points at a build output (`./dist`) whose README.md lives
 * at the project root, not in the build dir. Resolving the repo root here lets
 * `publishToPlayground` inline the project's README as the app detail page —
 * the same anchor the moddable preflight walks up to for the git origin
 * (`git remote get-url origin` resolves from any subdirectory), so README and
 * `repository` metadata stay consistent. Matches `deploy`, which passes its
 * project root (not the build dir) as the README `cwd`.
 *
 * `.git` is matched by existence, not type, so linked worktrees (where `.git`
 * is a file, not a directory) resolve correctly.
 */
export function findProjectRoot(startDir: string): string {
    const root = resolve(startDir);
    let dir = root;
    for (;;) {
        if (existsSync(join(dir, ".git"))) return dir;
        const parent = dirname(dir);
        if (parent === dir) return root; // reached the filesystem root, no repo
        dir = parent;
    }
}
