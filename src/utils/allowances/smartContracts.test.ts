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

import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ResolvedSigner } from "../signer.js";
import { hasAllowance, markAllowance } from "./marker.js";
import { ensureSmartContractAllowance } from "./smartContracts.js";

const ENV = "paseo-next-v2";
const OWNER = "5Owner";

let root: string | null = null;

beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), "playground-cli-smart-contract-allowance-"));
    process.env.POLKADOT_ROOT = root;
});

afterEach(async () => {
    delete process.env.POLKADOT_ROOT;
    if (root) await rm(root, { recursive: true, force: true });
    root = null;
});

function makeSigner(requestResourceAllocation?: ReturnType<typeof vi.fn>): ResolvedSigner {
    return {
        source: "session",
        address: OWNER,
        signer: {} as any,
        userSession: requestResourceAllocation ? ({ requestResourceAllocation } as any) : undefined,
        destroy() {},
    };
}

describe("ensureSmartContractAllowance", () => {
    it("skips local dev signers", async () => {
        const deploySigner: ResolvedSigner = {
            source: "dev",
            address: OWNER,
            signer: {} as any,
            destroy() {},
        };

        await expect(
            ensureSmartContractAllowance({ env: ENV, ownerAddress: OWNER, deploySigner }),
        ).resolves.toBeUndefined();
    });

    it("uses an existing allowance marker without prompting mobile", async () => {
        const requestResourceAllocation = vi.fn();
        await markAllowance(ENV, OWNER, "SmartContractAllowance");

        await ensureSmartContractAllowance({
            env: ENV,
            ownerAddress: OWNER,
            deploySigner: makeSigner(requestResourceAllocation),
        });

        expect(requestResourceAllocation).not.toHaveBeenCalled();
    });

    it("requests and marks a missing mobile smart-contract allowance", async () => {
        const requestResourceAllocation = vi.fn(async () => ({
            isErr: () => false,
            value: [
                {
                    tag: "Allocated",
                    value: { tag: "SmartContractAllowance", value: undefined },
                },
            ],
        }));

        await ensureSmartContractAllowance({
            env: ENV,
            ownerAddress: OWNER,
            deploySigner: makeSigner(requestResourceAllocation),
        });

        expect(requestResourceAllocation).toHaveBeenCalledWith({
            callingProductId: "playground.dot",
            resources: [{ tag: "SmartContractAllowance", value: 0 }],
            onExisting: "Ignore",
        });
        await expect(hasAllowance(ENV, OWNER, "SmartContractAllowance")).resolves.toBe(true);
    });

    it("throws an actionable error when mobile denies the allowance", async () => {
        const requestResourceAllocation = vi.fn(async () => ({
            isErr: () => false,
            value: [{ tag: "Rejected", value: undefined }],
        }));

        await expect(
            ensureSmartContractAllowance({
                env: ENV,
                ownerAddress: OWNER,
                deploySigner: makeSigner(requestResourceAllocation),
            }),
        ).rejects.toThrow(/Smart-contract gas allowance allocation Rejected/);
    });
});
