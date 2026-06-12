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
import { IPFS_MIGRATION_MESSAGE, isIpfsMigrationError, runStorageDeploy } from "./storage.js";

const bulletinDeployMock = vi.hoisted(() =>
    vi.fn(async () => ({
        cid: "bafyapp",
        ipfsCid: "bafyapp",
        carBytes: new Uint8Array(),
    })),
);

vi.mock("@parity/polkadot-app-deploy", () => ({
    deploy: bulletinDeployMock,
}));

describe("runStorageDeploy", () => {
    beforeEach(() => {
        bulletinDeployMock.mockReset();
        bulletinDeployMock.mockResolvedValue({
            cid: "bafyapp",
            ipfsCid: "bafyapp",
            carBytes: new Uint8Array(),
        });
    });

    it("passes the selected env and endpoints to polkadot-app-deploy", async () => {
        await runStorageDeploy({
            content: "/tmp/project/dist",
            domainName: "my-app",
            auth: {},
            env: "paseo-next-v2",
        });

        expect(bulletinDeployMock).toHaveBeenCalledWith(
            "/tmp/project/dist",
            "my-app",
            expect.objectContaining({
                env: "paseo-next-v2",
                rpc: "wss://paseo-bulletin-next-rpc.polkadot.io",
                assetHubEndpoints: ["wss://paseo-asset-hub-next-rpc.polkadot.io"],
            }),
        );
    });

    it("remaps Kubo's 'repo needs migration' abort to an actionable message", async () => {
        bulletinDeployMock.mockRejectedValueOnce(
            new Error(
                "Command failed: ipfs add -Q -r /tmp/x\nError: ipfs repo needs migration, please run migration tool.\n",
            ),
        );

        await expect(
            runStorageDeploy({
                content: "/tmp/project/dist",
                domainName: "my-app",
                auth: {},
                env: "paseo-next-v2",
            }),
        ).rejects.toThrow(IPFS_MIGRATION_MESSAGE);
    });

    it("passes non-migration deploy errors through unchanged", async () => {
        const original = new Error("AncientBirthBlock: chunk rejected");
        bulletinDeployMock.mockRejectedValueOnce(original);

        await expect(
            runStorageDeploy({
                content: "/tmp/project/dist",
                domainName: "my-app",
                auth: {},
                env: "paseo-next-v2",
            }),
        ).rejects.toBe(original);
    });
});

describe("isIpfsMigrationError", () => {
    it("matches Kubo's migration notice regardless of surrounding text", () => {
        expect(
            isIpfsMigrationError(new Error("…\nError: ipfs repo needs migration, please run …")),
        ).toBe(true);
        expect(isIpfsMigrationError(new Error("some other failure"))).toBe(false);
        expect(isIpfsMigrationError("repo needs migration")).toBe(true);
    });
});
