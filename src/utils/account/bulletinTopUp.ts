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
 * Top up the user's product-derived account from the same dev signer
 * `polkadot-app-deploy` funds its `attemptTestnetTopUp` from.
 *
 * On paseo-next-v2 the asset-hub runtime wires `pallet_revive::AutoMapper`
 * into the consumer-ref bump, so the first state-changing tx the user submits
 * from the product-derived account creates its H160 mapping automatically.
 * No explicit `Revive.map_account` is needed. `polkadot-app-deploy`'s deploy
 * flow then submits a `Revive.call` to `DotNS_RegistrarController.minCommitmentAge`
 * as the auto-map trigger, but only after confirming the substrate signer
 * holds at least `FEE_FLOOR_REGISTER` (0.1 PAS); otherwise the trigger tx
 * runs out of fees and the deploy reverts.
 *
 * We replicate that top-up here during `dot login` so the next `dot deploy`
 * (run from the same product account) has the headroom polkadot-app-deploy
 * expects. Crucially we use the SAME source signer polkadot-app-deploy uses:
 * the bare master account from the standard substrate dev mnemonic, NOT the
 * canonical `//Alice` derived account. paseo-next-v2 pre-funds this specific
 * address; our own `funder.ts::FUNDER_CHAIN` uses `seedToAccount(DEV_PHRASE,
 * "//Alice")` which resolves to a different SS58 that is unfunded on the v2
 * chain.
 *
 * Replace this module with a re-export from `polkadot-app-deploy` once it
 * surfaces `attemptTestnetTopUp` (or an equivalent) at the package root.
 */

import { Enum } from "polkadot-api";
import { submitAndWatch } from "@parity/product-sdk-tx";
import { seedToAccount } from "@parity/product-sdk-keys";
import { getNetworkLabel } from "../../config.js";
import type { PaseoClient } from "../connection.js";

/**
 * Substrate dev mnemonic. Mirrors `DEFAULT_MNEMONIC` in
 * `polkadot-app-deploy/src/dotns.ts`.
 */
const BULLETIN_DEV_MNEMONIC =
    "bottom drive obey lake curtain smoke basket hold race lonely fit walk";

/**
 * Lazy-initialised dev master account. Empty derivation path resolves to the
 * bare master from the mnemonic, matching `keyring.addFromUri(DEFAULT_MNEMONIC)`
 * in polkadot-app-deploy (the `{ label: "Alice", uri: DEFAULT_MNEMONIC }` branch
 * of `attemptTestnetTopUp`). This is DIFFERENT from `seedToAccount(DEV_PHRASE,
 * "//Alice")`. paseo-next-v2's pre-funding sits on the bare-master address,
 * not on the `//Alice` derived one.
 *
 * Lazy so commands that never call `topUpFromBulletinDev` (deploy, mod, etc.)
 * don't pay the sr25519 derivation cost during module load.
 */
let cachedDevAccount: ReturnType<typeof seedToAccount> | null = null;
function getDevAccount(): ReturnType<typeof seedToAccount> {
    if (cachedDevAccount === null) {
        cachedDevAccount = seedToAccount(BULLETIN_DEV_MNEMONIC, "");
    }
    return cachedDevAccount;
}

/** 1 PAS in planck. Asset Hub Paseo uses 12 decimals. */
const ONE_PAS = 1_000_000_000_000n;

/**
 * Skip the top-up if the product-derived account already holds at least this
 * much PAS. Matches polkadot-app-deploy's `FEE_FLOOR_REGISTER` (0.1 PAS), the
 * threshold above which polkadot-app-deploy's own `attemptTestnetTopUp` no-ops.
 * Keeping the same floor means re-running `dot login` doesn't drain the shared
 * dev faucet on every invocation.
 */
const SKIP_TRANSFER_THRESHOLD = 100_000_000_000n;

/**
 * Headroom on top of the 1 PAS transfer that the dev master must carry. Covers
 * the `Balances.transfer_allow_death` fee plus a safety margin so subsequent
 * `dot login` runs immediately after a depleting transfer don't see a
 * temporarily-low balance and abort. 1 PAS matches polkadot-app-deploy's
 * `SOURCE_BUFFER`.
 */
const SOURCE_BUFFER = 1_000_000_000_000n;

/**
 * Custom error surfaced when the shared dev master can no longer cover a
 * top-up. Operator-facing — points at the address the next refill should
 * target so on-call doesn't have to grep the source.
 */
export class DevFunderExhaustedError extends Error {
    readonly address: string;
    readonly free: bigint;
    readonly required: bigint;
    constructor(address: string, free: bigint, required: bigint) {
        super(
            `Dev funder ${address} is too low to top up the product account: free=${free} planck, need ≥${required} planck. Refill on ${getNetworkLabel()} Asset Hub before re-running.`,
        );
        this.name = "DevFunderExhaustedError";
        this.address = address;
        this.free = free;
        this.required = required;
    }
}

export interface TopUpResult {
    skipped: boolean;
    transferred?: bigint;
}

/**
 * Ensure `recipient` (the product-derived SS58) holds at least
 * `SKIP_TRANSFER_THRESHOLD` PAS on Asset Hub. Sends `ONE_PAS` from the
 * polkadot-app-deploy dev signer if the recipient is below the floor; no-ops
 * otherwise. Waits for GRANDPA finalization before returning so subsequent
 * `dot deploy` runs don't race a re-org that would roll back the credit.
 *
 * Throws {@link DevFunderExhaustedError} if the dev master no longer carries
 * `ONE_PAS + SOURCE_BUFFER` (matches polkadot-app-deploy's preflight floor in
 * `attemptTestnetTopUp`); preflight catch surfaces the funder address so the
 * operator knows where to refill. Self-transfer is a hypothetical (would need
 * the dev mnemonic to derive a session key) but the equality check is cheap.
 */
export async function topUpFromBulletinDev(
    client: PaseoClient,
    recipient: string,
): Promise<TopUpResult> {
    const recipientAccount = await client.assetHub.query.System.Account.getValue(recipient, {
        at: "best",
    });
    if (recipientAccount.data.free >= SKIP_TRANSFER_THRESHOLD) {
        return { skipped: true };
    }

    const dev = getDevAccount();
    if (dev.ss58Address === recipient) {
        // Mirrors polkadot-app-deploy's `attemptTestnetTopUp` self-transfer guard
        // (account.address === recipientSs58 short-circuits there too).
        return { skipped: true };
    }

    const required = ONE_PAS + SOURCE_BUFFER;
    const devBalance = await client.assetHub.query.System.Account.getValue(dev.ss58Address, {
        at: "best",
    });
    if (devBalance.data.free < required) {
        throw new DevFunderExhaustedError(dev.ss58Address, devBalance.data.free, required);
    }

    await submitAndWatch(
        client.assetHub.tx.Balances.transfer_allow_death({
            dest: Enum("Id", recipient),
            value: ONE_PAS,
        }),
        dev.signer,
        { waitFor: "finalized" },
    );
    return { skipped: false, transferred: ONE_PAS };
}
