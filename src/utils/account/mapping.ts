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
 * Revive account mapping — SS58 ↔ H160 (read-only check).
 *
 * On paseo-next-v2 the asset-hub runtime wires `pallet_revive::AutoMapper` into
 * `frame_system::OnNewAccount` (see polkadot-sdk
 * `substrate/frame/revive/src/address.rs::AutoMapper`), so any account that
 * has had a provider/sufficient ref bumped — first balance transfer, first
 * sufficient-asset credit, etc. — is auto-mapped via
 * `AddressMapper::map_no_deposit` without ever needing an explicit
 * `Revive.map_account` extrinsic. The login-time `SmartContractAllowance`
 * grant triggers exactly that: the phone's `Pgas.claim_pgas` mints PGAS (a
 * sufficient asset) to the product account, creating and auto-mapping it.
 * The CLI therefore only ever READS the mapping; the old write-side helpers
 * (`ensureMapped`, the dev-account top-up) were removed with the
 * funding-removal change.
 */

import type { PaseoClient } from "../connection.js";

export interface CheckMappingOptions {
    /**
     * Total read attempts before reporting "not mapped". >1 makes the check
     * robust right after an on-chain side effect (e.g. the login-time PGAS
     * claim): the phone confirms in-block against ITS node's best chain, and
     * our (load-balanced) RPC node may import that block a moment later.
     */
    attempts?: number;
    /** Pause between attempts. */
    delayMs?: number;
    /** Injectable for tests. */
    sleep?: (ms: number) => Promise<void>;
}

const defaultSleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * Returns true iff `address` (SS58) is mapped in Revive.
 *
 * Mirrors `polkadot-app-deploy/src/dotns.ts::checkIfAccountMapped`: derive the
 * H160 via the `ReviveApi.address` runtime call (canonical
 * `AddressMapper::to_address(account_id)` on the chain side), then query
 * `Revive.OriginalAccount[H160]` — non-null iff the H160 has an associated
 * SS58 binding stored.
 *
 * The load-bearing read-path choice is `at: "best"` instead of PAPI's default
 * `"finalized"`: paseo-next-v2's Asset Hub finalization lags 13-14 blocks
 * (~80 s, measured live 2026-06-11). The phone reports a PGAS claim
 * `Allocated` as soon as it is in a BEST block, so a finalized-head read in
 * the next few seconds deterministically misses the just-created account and
 * login falsely reported "NOT mapped". A best-head false positive (mapping
 * re-orged out) is harmless for this UX gate.
 *
 * `getUnsafeApi()` is defence-in-depth, NOT a fix for an observed bug: typed
 * reads of `Revive.OriginalAccount` were verified working live against
 * `@parity/product-sdk-descriptors@0.6.0` (2026-06-11). An earlier comment
 * here claimed the typed read "can throw Incompatible runtime entry" on
 * descriptor drift; during the 2026-06-11 debugging that hypothetical was
 * briefly mistaken for the root cause — it never reproduced. The unsafe API
 * simply keeps this check immune if descriptors ever lag a runtime upgrade
 * (same descriptor-free approach polkadot-app-deploy uses throughout).
 */
export async function checkMapping(
    client: PaseoClient,
    address: string,
    opts: CheckMappingOptions = {},
): Promise<boolean> {
    const attempts = Math.max(1, opts.attempts ?? 1);
    const delayMs = opts.delayMs ?? 2000;
    const sleep = opts.sleep ?? defaultSleep;

    for (let attempt = 1; attempt <= attempts; attempt++) {
        try {
            const unsafeApi = client.raw.assetHub.getUnsafeApi();
            const evmAddress = await unsafeApi.apis.ReviveApi.address(address, { at: "best" });
            const original: unknown = await unsafeApi.query.Revive.OriginalAccount.getValue(
                evmAddress,
                { at: "best" },
            );
            if (original !== null && original !== undefined) return true;
        } catch (err) {
            if (process.env.DOT_DEPLOY_VERBOSE === "1") {
                // eslint-disable-next-line no-console
                console.error(
                    `[checkMapping] attempt ${attempt}/${attempts} failed: ${err instanceof Error ? err.message : String(err)}`,
                );
            }
        }
        if (attempt < attempts) await sleep(delayMs);
    }
    return false;
}
