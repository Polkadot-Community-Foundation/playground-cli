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

import type { PolkadotSigner } from "polkadot-api";
import type { Env } from "../../config.js";
import type { ResolvedSigner } from "../signer.js";
import { requestResourceAllocation, type OnExistingAllowancePolicy } from "./host.js";
import { markAllowance } from "./marker.js";
import {
    createSlotAccountSigner,
    extractSlotAccountKey,
    readSlotAccountKey,
    storeSlotAccountKey,
} from "./slotKeys.js";

export interface BulletinAllowanceSignerOptions {
    env: Env;
    ownerAddress: string;
    productId: string;
    publishSigner: ResolvedSigner;
    onRequest?: (policy: OnExistingAllowancePolicy) => void;
}

export async function getBulletinAllowanceSigner({
    env,
    ownerAddress,
    productId,
    publishSigner,
    onRequest,
}: BulletinAllowanceSignerOptions): Promise<PolkadotSigner> {
    // Local dev/SURI deploys are the explicit CI escape hatch: the caller
    // supplied a local key and owns making sure it has Bulletin allowance.
    if (publishSigner.source === "dev") return publishSigner.signer;

    const cached = await readSlotAccountKey(env, ownerAddress, "BulletInAllowance");
    if (cached) return createSlotAccountSigner(cached);

    if (!publishSigner.userSession) {
        throw new Error("Bulletin allowance key missing. Run `dot init` and approve allowances.");
    }

    return await requestAndStoreBulletinAllowanceSigner({
        env,
        ownerAddress,
        productId,
        publishSigner,
        policy: "Ignore",
        onRequest,
    });
}

export async function requestAndStoreBulletinAllowanceSigner({
    env,
    ownerAddress,
    productId,
    publishSigner,
    policy,
    onRequest,
}: BulletinAllowanceSignerOptions & {
    policy: OnExistingAllowancePolicy;
}): Promise<PolkadotSigner> {
    if (publishSigner.source === "dev") return publishSigner.signer;
    if (!publishSigner.userSession) {
        throw new Error("Cannot request Bulletin allowance without an active mobile session.");
    }

    onRequest?.(policy);
    const outcomes = await requestResourceAllocation(
        publishSigner.userSession,
        productId,
        [{ tag: "BulletInAllowance", value: undefined }],
        policy,
    );
    const key = extractSlotAccountKey(outcomes, "BulletInAllowance");
    if (!key) {
        const outcome = outcomes[0]?.tag ?? "missing";
        throw new Error(`Bulletin allowance was not granted (${outcome}).`);
    }

    await storeSlotAccountKey(env, ownerAddress, "BulletInAllowance", key);
    await markAllowance(env, ownerAddress, "BulletInAllowance", "host");
    return createSlotAccountSigner(key);
}

export function isInvalidPaymentError(err: unknown): boolean {
    const message = err instanceof Error ? err.message : String(err);
    return /"type"\s*:\s*"Invalid"[\s\S]*"type"\s*:\s*"Payment"/.test(message);
}
