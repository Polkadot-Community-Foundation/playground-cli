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
 * On-chain username lookup for the user's root account.
 *
 * The data lives on the People parachain in `Resources.Consumers` (the
 * statement-store storage map). `@novasamatech/host-papp` exposes the same
 * query inside `createIdentityRpcAdapter`, but the factory is not re-exported
 * at the package root and host-papp's `exports` field blocks deep imports
 * (see `node_modules/@novasamatech/host-papp/package.json`). Adding host-papp
 * as a direct dep just for this one-shot call would also pull in the full
 * SSO/sessions/identity-cache pipeline we don't need. So we mirror the small
 * piece we do need: the storage query + the byte mapping. Same precedent as
 * `src/utils/allowances/host.ts` (which mirrors host-papp's RFC-0010 call).
 *
 * The upstream source we're mirroring lives in
 * `@novasamatech/host-papp@0.7.9-4/dist/identity/rpcAdapter.js`; keep this in
 * sync if that ever changes pallet/storage names.
 */

import { AccountId, createClient } from "polkadot-api";
import { getWsProvider } from "polkadot-api/ws";
import { getChainConfig } from "../config.js";

const LOOKUP_TIMEOUT_MS = 5_000;

export type UsernameLookup =
    | { kind: "loading" }
    | { kind: "found"; fullUsername: string | null; liteUsername: string }
    | { kind: "none" }
    | { kind: "error"; reason: string };

export function formatUsernameLine(lookup: UsernameLookup): string {
    switch (lookup.kind) {
        case "loading":
            return "(looking up...)";
        case "found":
            return lookup.fullUsername ?? lookup.liteUsername;
        case "none":
            return "(no username set on chain)";
        case "error":
            return "(lookup failed)";
    }
}

/**
 * Raw shape of the `Resources.Consumers` storage value, mirrored from
 * `@novasamatech/host-papp/dist/identity/rpcAdapter.js`. Typed as `unknown`
 * fields where we only need a few keys; `getUnsafeApi()` returns `any`-ish
 * values so we narrow defensively at the read site.
 */
type ConsumerRecord = {
    full_username: Uint8Array | null;
    lite_username: Uint8Array;
    credibility: unknown;
};

/**
 * Look up the on-chain identity for `rootAccountSs58` with a hard timeout.
 *
 * Returns within ~5 seconds regardless of network conditions. Slow paths
 * return `{ kind: "error", reason: "lookup timed out" }`. The lookup uses
 * the People parachain endpoints from `getChainConfig()`.
 */
export async function lookupUsername(rootAccountSs58: string): Promise<UsernameLookup> {
    const { peopleEndpoints } = getChainConfig();
    const client = createClient(getWsProvider(peopleEndpoints));
    try {
        const accCodec = AccountId();
        const accountKey = accCodec.dec(rootAccountSs58);
        const unsafeApi = client.getUnsafeApi();
        const query = unsafeApi.query.Resources?.Consumers;
        if (!query) {
            return {
                kind: "error",
                reason: "Resources.Consumers storage not found on chain",
            };
        }

        const result = await Promise.race([
            query.getValues([[accountKey]]) as Promise<Array<ConsumerRecord | undefined | null>>,
            new Promise<"timeout">((resolve) =>
                setTimeout(() => resolve("timeout"), LOOKUP_TIMEOUT_MS),
            ),
        ]);

        if (result === "timeout") {
            return { kind: "error", reason: "lookup timed out" };
        }

        const raw = result[0];
        if (!raw) return { kind: "none" };

        const textDecoder = new TextDecoder();
        return {
            kind: "found",
            fullUsername: raw.full_username ? textDecoder.decode(raw.full_username) : null,
            liteUsername: textDecoder.decode(raw.lite_username),
        };
    } catch (err) {
        return {
            kind: "error",
            reason: err instanceof Error ? err.message : String(err),
        };
    } finally {
        // Fire-and-forget. The CLI's process-guard catches benign
        // post-destroy artifacts from polkadot-api's chainHead unfollow race.
        client.destroy();
    }
}
