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

import { describe, it, expect, vi, beforeEach } from "vitest";

const ensureSpy = vi.fn();
vi.mock("../packageManagers.js", () => ({
    ensurePackageManager: (...args: unknown[]) => ensureSpy(...args),
}));
const runStreamedSpy = vi.fn(async (..._a: unknown[]) => {});
vi.mock("../process.js", () => ({ runStreamed: (...a: unknown[]) => runStreamedSpy(...a) }));

import { runBuild } from "./runner.js";
import { writeFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

describe("runBuild ensures the package manager before installing", () => {
    beforeEach(() => {
        ensureSpy.mockReset();
        runStreamedSpy.mockReset();
    });

    it("calls ensurePackageManager before the install step runs", async () => {
        const dir = mkdtempSync(join(tmpdir(), "pm-runner-"));
        writeFileSync(
            join(dir, "package.json"),
            JSON.stringify({ scripts: { build: "echo built" }, dependencies: { left: "1" } }),
        );
        const order: string[] = [];
        ensureSpy.mockImplementation(async () => {
            order.push("ensure");
        });
        runStreamedSpy.mockImplementation(async () => {
            order.push("run");
        });

        await runBuild({ cwd: dir });

        expect(ensureSpy).toHaveBeenCalledTimes(1);
        // ensure runs once, before both the install and build runStreamed calls.
        expect(order).toEqual(["ensure", "run", "run"]);
    });

    it("does not ensure a package manager for a deps-free project", async () => {
        const dir = mkdtempSync(join(tmpdir(), "pm-runner-nodeps-"));
        // No dependencies/devDependencies → detectInstallConfig returns null →
        // no install step, so there is no PM to ensure.
        writeFileSync(
            join(dir, "package.json"),
            JSON.stringify({ scripts: { build: "echo built" } }),
        );

        await runBuild({ cwd: dir });

        expect(ensureSpy).not.toHaveBeenCalled();
    });
});
