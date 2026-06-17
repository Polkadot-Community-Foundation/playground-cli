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
 * Builder-identity gate.
 *
 * The value-creating commands (`mod`/`init`, `deploy`, `decentralize`,
 * `deploy-all`) are reserved for users who have "revealed themselves" — bound
 * a verified identity on-chain via the playground-app's "Become a builder"
 * flow. Anonymous accounts earn no competition points, so the CLI refuses to
 * act for them.
 *
 * "Revealed" is decided exactly as the playground-app decides it
 * (`hasRevealedIdentity`): `playground-registry.getRootAccount(productH160)`
 * returns a NON-zero bytes32. The contract `unwrap_or`s a missing binding to 32
 * zero bytes and never reverts, so the zero sentinel IS the "anonymous" answer.
 *
 * This module is pure logic (no React/Ink). The session's product H160 is
 * derived signer-free from the persisted login (`findSession` ->
 * `deriveSessionAddresses`), and the read uses the keyless revive origin
 * (`getReadOnlyRegistryContract`), so evaluating the gate needs neither a phone
 * tap nor a mapped/funded account.
 */

import type { PolkadotClient } from "polkadot-api";
import { findSession, deriveSessionAddresses } from "../auth.js";
import { getReadOnlyRegistryContract } from "../registry.js";

export type IdentityGateResult =
    | { status: "revealed"; productH160: `0x${string}` }
    | { status: "not-logged-in" }
    | { status: "anonymous"; productH160: `0x${string}` }
    | { status: "unverifiable"; detail: string };

/** Blocked outcomes — everything except `revealed`. */
export type BlockedIdentityStatus = "not-logged-in" | "anonymous" | "unverifiable";

interface RootQueryResult {
    success: boolean;
    value?: unknown;
}

/**
 * Minimal structural view of the registry handle. `getReadOnlyRegistryContract`
 * returns a runtime Proxy (via `suppressReviveTraceNoise`) whose full typing we
 * don't want to depend on here. The generated ABI does expose `getRootAccount`
 * (`.cdm/contracts.d.ts`, `response: SizedHex<32>` — i.e. a hex string); we
 * narrow to just the one read method we call.
 */
export interface IdentityRegistry {
    getRootAccount: { query(account: `0x${string}`): Promise<RootQueryResult> };
}

interface GateOptions {
    /** Dry-run retry budget. Defaults to 2 (a transient RPC blip shouldn't lock out a builder). */
    attempts?: number;
    /** Delay between retries in ms. Defaults to 250. */
    delayMs?: number;
    /**
     * Pre-resolved registry handle. Callers that already built one (e.g. `mod`)
     * pass it to avoid a second meta-registry resolution + Revive dry-run. When
     * omitted, the gate resolves its own from `rawAssetHubClient`.
     */
    registry?: IdentityRegistry;
}

function describe(err: unknown): string {
    return err instanceof Error ? err.message : String(err);
}

const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

/**
 * Whether a `getRootAccount` result represents an anonymous (unbound) account.
 *
 * Robust to the representations a bytes32 contract output can arrive as: a
 * `0x`-prefixed (or bare) hex string, a `Uint8Array`/number array, or
 * null/undefined (treated as anonymous). Throws on anything unrecognized so the
 * orchestrator degrades to `unverifiable` rather than guessing.
 */
export function isAnonymousRoot(value: unknown): boolean {
    if (value === null || value === undefined) return true;
    if (typeof value === "string") {
        const hex = value.slice(0, 2).toLowerCase() === "0x" ? value.slice(2) : value;
        return hex.length === 0 || /^0+$/.test(hex);
    }
    if (value instanceof Uint8Array) return value.every((b) => b === 0);
    if (Array.isArray(value)) return value.every((b) => Number(b) === 0);
    throw new Error(`Unrecognized root account representation: ${typeof value}`);
}

async function queryRoot(
    registry: IdentityRegistry,
    account: `0x${string}`,
    attempts: number,
    delayMs: number,
): Promise<unknown> {
    let lastError: unknown;
    for (let i = 0; i < attempts; i++) {
        try {
            const res = await registry.getRootAccount.query(account);
            if (res.success) return res.value;
            lastError = new Error("registry.getRootAccount dry-run was rejected (success=false)");
        } catch (err) {
            lastError = err;
        }
        if (i < attempts - 1 && delayMs > 0) await sleep(delayMs);
    }
    throw lastError instanceof Error ? lastError : new Error(describe(lastError));
}

/**
 * Evaluate the builder-identity gate for the currently signed-in session.
 *
 * Never throws: any failure to read the binding collapses to `unverifiable`
 * (fail-closed — the caller blocks, but softly). Always releases the session
 * adapter it opens, on every path (we only need the derived address, never the
 * signer).
 */
export async function checkIdentityGate(
    rawAssetHubClient: PolkadotClient,
    opts: GateOptions = {},
): Promise<IdentityGateResult> {
    const attempts = Math.max(1, opts.attempts ?? 2);
    const delayMs = opts.delayMs ?? 250;

    const handle = await findSession();
    if (!handle) return { status: "not-logged-in" };

    let productH160: `0x${string}`;
    try {
        productH160 = deriveSessionAddresses(handle.session).productH160;
    } catch (err) {
        return { status: "unverifiable", detail: describe(err) };
    } finally {
        // The signer is never used here — release the adapter so its WebSocket
        // doesn't keep the event loop alive (mirrors `drip`/`status`).
        await handle.adapter.destroy().catch(() => {});
    }

    try {
        const registry =
            opts.registry ??
            ((await getReadOnlyRegistryContract(rawAssetHubClient)) as unknown as IdentityRegistry);
        const root = await queryRoot(registry, productH160, attempts, delayMs);
        return isAnonymousRoot(root)
            ? { status: "anonymous", productH160 }
            : { status: "revealed", productH160 };
    } catch (err) {
        return { status: "unverifiable", detail: describe(err) };
    }
}
