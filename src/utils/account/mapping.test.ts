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
 * Tests for the Revive-mapping wrapper.
 *
 * `checkMapping` mirrors polkadot-app-deploy's canonical pattern: derive the H160
 * via `ReviveApi.address`, then query `Revive.OriginalAccount[H160]` —
 * non-null iff the binding exists.
 *
 * Load-bearing read-path details pinned here:
 *   - reads pass `{ at: "best" }` — paseo-next-v2 finalization lags ~80 s
 *     behind the best head the phone's in-block claim confirmation refers to,
 *     so a finalized-head read right after a grant falsely reported "NOT
 *     mapped" (shipped 2026-06-11), and
 *   - reads go through `raw.assetHub.getUnsafeApi()` as defence-in-depth so
 *     the check can't break if bundled descriptors ever lag a runtime
 *     upgrade (typed reads verified working at descriptors@0.6.0 — there is
 *     no actual drift today).
 *
 * RPC failures resolve to `false` (treated as "not mapped" so the caller can
 * surface a retry-later message rather than an opaque error during login).
 */

import { describe, it, expect, vi } from "vitest";

const { checkMapping } = await import("./mapping.js");

const FAKE_H160 = new Uint8Array(20);

function makeClient(opts: {
    address: Uint8Array | (() => Promise<Uint8Array>) | (() => Promise<never>);
    original: string | null | (() => Promise<string | null>) | (() => Promise<never>);
}) {
    const addressApi = typeof opts.address === "function" ? opts.address : async () => opts.address;
    const originalApi =
        typeof opts.original === "function" ? opts.original : async () => opts.original;
    // checkMapping reads through raw.assetHub.getUnsafeApi() (metadata-driven,
    // robust to bundled-descriptor staleness). The same fn instances are also
    // exposed on the typed-looking `assetHub` surface purely so assertions can
    // reference them with a short path.
    const apis = {
        ReviveApi: {
            address: vi.fn(addressApi),
        },
    };
    const query = {
        Revive: {
            OriginalAccount: {
                getValue: vi.fn(originalApi),
            },
        },
    };
    return {
        raw: { assetHub: { __raw: true, getUnsafeApi: () => ({ apis, query }) } },
        assetHub: { apis, query },
    } as any;
}

describe("checkMapping", () => {
    it("returns true when Revive.OriginalAccount has a binding for the derived H160", async () => {
        const client = makeClient({ address: FAKE_H160, original: "5Galice…" });
        const result = await checkMapping(client, "5GrwvaEF...");

        expect(result).toBe(true);
        expect(client.assetHub.apis.ReviveApi.address).toHaveBeenCalledWith("5GrwvaEF...", {
            at: "best",
        });
        expect(client.assetHub.query.Revive.OriginalAccount.getValue).toHaveBeenCalledWith(
            FAKE_H160,
            { at: "best" },
        );
    });

    it("returns false when Revive.OriginalAccount returns null", async () => {
        const client = makeClient({ address: FAKE_H160, original: null });
        const result = await checkMapping(client, "5Fxxx...");
        expect(result).toBe(false);
    });

    it("treats OriginalAccount RPC errors as 'not mapped' so login can surface a retry-later hint", async () => {
        const client = makeClient({
            address: FAKE_H160,
            original: async () => {
                throw new Error("connection reset");
            },
        });
        await expect(checkMapping(client, "5F...")).resolves.toBe(false);
    });

    it("returns false if ReviveApi.address itself fails", async () => {
        const client = makeClient({
            address: async () => {
                throw new Error("runtime api unavailable");
            },
            original: null,
        });
        await expect(checkMapping(client, "5F...")).resolves.toBe(false);
    });

    it("retries until the binding appears (claim block propagating across RPC nodes)", async () => {
        let calls = 0;
        const client = makeClient({
            address: FAKE_H160,
            original: async () => (++calls >= 3 ? "5Gmapped…" : null),
        });
        const sleep = vi.fn().mockResolvedValue(undefined);

        const result = await checkMapping(client, "5F...", {
            attempts: 6,
            delayMs: 2000,
            sleep,
        });

        expect(result).toBe(true);
        expect(calls).toBe(3);
        expect(sleep).toHaveBeenCalledTimes(2);
        expect(sleep).toHaveBeenCalledWith(2000);
    });

    it("gives up after the configured attempts and reports not mapped", async () => {
        const client = makeClient({ address: FAKE_H160, original: null });
        const sleep = vi.fn().mockResolvedValue(undefined);

        const result = await checkMapping(client, "5F...", { attempts: 3, sleep });

        expect(result).toBe(false);
        expect(client.assetHub.query.Revive.OriginalAccount.getValue).toHaveBeenCalledTimes(3);
        // no trailing sleep after the final attempt
        expect(sleep).toHaveBeenCalledTimes(2);
    });
});
