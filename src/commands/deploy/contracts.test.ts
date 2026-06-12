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

import type { DeploySummary } from "@parity/cdm-builder";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../contract.js", () => ({
    runContractDeploy: vi.fn(),
    runContractInstall: vi.fn(),
}));

import { runContractDeploy, runContractInstall } from "../contract.js";
import { installLibrariesFromDeploySummary, runContractsBeforeFrontend } from "./contracts.js";

describe("runContractsBeforeFrontend", () => {
    beforeEach(() => {
        vi.mocked(runContractDeploy).mockReset();
        vi.mocked(runContractInstall).mockReset();
        // A benign success so the legacy path would complete normally — the
        // test then proves our zero-contracts guard fires before this is used.
        vi.mocked(runContractInstall).mockResolvedValue({
            success: true,
            summary: { results: [], errors: [], success: true, totalDurationMs: 0 },
        } as Awaited<ReturnType<typeof runContractInstall>>);
    });

    it("throws an actionable error when no contracts are found, without installing", async () => {
        vi.mocked(runContractDeploy).mockResolvedValue({
            success: true,
            summary: { totalDurationMs: 1, contracts: [] },
        });

        await expect(
            runContractsBeforeFrontend({
                projectDir: "/tmp/my-frontend-app",
                mode: "dev",
                userSigner: null,
            }),
        ).rejects.toThrow(/no contracts were found in \/tmp\/my-frontend-app/);

        expect(runContractInstall).not.toHaveBeenCalled();
    });

    it("installs the deployed CDM packages when contracts are present", async () => {
        vi.mocked(runContractDeploy).mockResolvedValue({
            success: true,
            summary: {
                totalDurationMs: 1,
                contracts: [{ crate: "counter", cdmPackage: "@example/counter", status: "done" }],
            },
        });

        const result = await runContractsBeforeFrontend({
            projectDir: "/tmp/app-with-contracts",
            mode: "dev",
            userSigner: null,
        });

        expect(runContractInstall).toHaveBeenCalledTimes(1);
        expect(runContractInstall).toHaveBeenCalledWith(
            ["@example/counter"],
            { rootDir: "/tmp/app-with-contracts" },
            expect.objectContaining({ useUi: false }),
        );
        expect(result.installedLibraries).toEqual(["@example/counter"]);
    });
});

describe("installLibrariesFromDeploySummary", () => {
    it("deduplicates successful CDM packages and skips failed contracts", () => {
        const summary: DeploySummary = {
            totalDurationMs: 123,
            contracts: [
                {
                    crate: "counter",
                    cdmPackage: "@example/counter",
                    status: "done",
                },
                {
                    crate: "counter-copy",
                    cdmPackage: "@example/counter",
                    status: "cached",
                },
                {
                    crate: "broken",
                    cdmPackage: "@example/broken",
                    status: "error",
                    error: "failed",
                },
            ],
        };

        expect(installLibrariesFromDeploySummary(summary)).toEqual(["@example/counter"]);
    });
});
