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

import { statSync } from "node:fs";
import { resolve } from "node:path";

/**
 * Preflight check for a `--no-build` (skip-build) deploy: the build artifacts
 * must already exist on disk, since nothing is going to produce them.
 *
 * Without this, a missing/typo'd `--buildDir` is only discovered deep inside
 * polkadot-app-deploy's storage phase (`▸ storage-and-dotns`) — after the
 * availability round-trip, the summary block, and any on-chain work — where it
 * surfaces as an opaque `Path not found`. Calling this up front turns that into
 * a fast, actionable failure before any of that happens.
 *
 * `buildDir` is interpreted relative to `projectDir` (the build's working
 * directory, where artifacts land), matching `RunDeployOptions.buildDir`. An
 * absolute `buildDir` is used as-is.
 *
 * Pure (throws on failure, returns void on success) so it stays unit-testable
 * without rendering the TUI or running a deploy.
 */
export function assertBuildDirExists(projectDir: string, buildDir: string): void {
    const abs = resolve(projectDir, buildDir);
    let stats;
    try {
        stats = statSync(abs);
    } catch {
        throw new Error(
            `Build directory not found: ${abs}\n` +
                "Build the project first (remove --no-build), or point --buildDir at the " +
                "directory that holds your build artifacts.",
        );
    }
    if (!stats.isDirectory()) {
        throw new Error(
            `Build path is not a directory: ${abs}\n` +
                "Point --buildDir at the directory that holds your build artifacts.",
        );
    }
}
