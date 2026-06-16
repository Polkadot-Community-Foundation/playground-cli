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

import { getPgasAssetId } from "../../config.js";
import type { PaseoClient } from "../connection.js";

const AT_BEST = { at: "best" } as const;

/**
 * Read an account's PGAS balance in planck. PGAS is a `sufficient` asset in the
 * `Assets` pallet (NOT the native token), keyed by `[assetId, who]`; the storage
 * entry is Option-typed, so an absent entry means a zero balance. Uses
 * `{ at: "best" }` (not finalized) because product-account reads must reflect
 * the best head — finalization lags ~13-14 blocks on paseo-next-v2 (same
 * rationale as `account/mapping.ts`).
 *
 * The asset carries no on-chain metadata on paseo-next-v2, so decimals/symbol
 * are NOT read here — PGAS is 1:1 with PAS and the caller formats it at the
 * shared `PAS_DECIMALS` scale (see `account/drip.ts`).
 */
export async function readPgasBalance(client: PaseoClient, address: string): Promise<bigint> {
    const assetId = getPgasAssetId();
    const account = await client.assetHub.query.Assets.Account.getValue(assetId, address, AT_BEST);
    return account?.balance ?? 0n;
}

/**
 * Max fractional digits shown. Matches `formatPas` (`account/drip.ts`) so the
 * native PAS row and the 1:1 PGAS row render at the same precision instead of
 * one showing 4 digits and the other all 12.
 */
const MAX_FRACTION_DIGITS = 4;

/**
 * Render a planck-style integer amount with `decimals` fractional places and a
 * symbol suffix, grouping the integer part with thousands separators and
 * capping the fraction at `MAX_FRACTION_DIGITS` (trailing zeros trimmed) — e.g.
 * `1.5 PGAS`, `50 PGAS`, `354,793,859,857`. An empty symbol omits the suffix
 * (the caller's row label carries the unit). With `decimals <= 0` the value
 * renders as a grouped integer in the asset's base units. Mirrors `formatPas`'s
 * formatting so PAS and the 1:1 PGAS balance read consistently.
 */
export function formatTokenAmount(value: bigint, decimals: number, symbol: string): string {
    const label = symbol.length > 0 ? ` ${symbol}` : "";
    if (decimals <= 0) return `${group(value)}${label}`;

    const base = 10n ** BigInt(decimals);
    const whole = value / base;
    const frac = value % base;
    if (frac === 0n) return `${group(whole)}${label}`;

    const fracStr = frac
        .toString()
        .padStart(decimals, "0")
        .slice(0, MAX_FRACTION_DIGITS)
        .replace(/0+$/, "");
    return fracStr ? `${group(whole)}.${fracStr}${label}` : `${group(whole)}${label}`;
}

/** Thousands-separated decimal string for a non-negative bigint. */
function group(value: bigint): string {
    return value.toLocaleString("en-US");
}
