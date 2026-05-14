#!/usr/bin/env bun
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
 * One-shot operator probe: dump the bulletin-deploy dev funder's free /
 * reserved / frozen balance on both stable Paseo Asset Hub (where an operator
 * faucets / teleports from) and paseo-next-v2 Asset Hub (where the CLI's
 * `dot init` consumes funds from). Run via:
 *   bun run tools/check-bulletin-funder.ts
 *
 * Address is derived inside `src/utils/account/bulletinTopUp.ts` — keep this
 * tool's hardcoded SS58 in sync with the bare-master output of
 * `tools/print-bulletin-dev-address.ts`.
 */

import { createClient } from "polkadot-api";
import { getWsProvider } from "polkadot-api/ws";

const ADDRESS = "5DfhGyQdFobKM8NsWvEeAKk5EQQgYe9AydgJ7rMB6E1EqRzV";

const CHAINS = [
    { label: "stable Paseo Asset Hub (paraId 1000)", wss: "wss://asset-hub-paseo-rpc.n.dwellir.com" },
    { label: "Paseo Next v2 Asset Hub (paraId 1500)", wss: "wss://paseo-asset-hub-next-rpc.polkadot.io" },
];

function fmtPas(planck: bigint): string {
    const whole = planck / 1_000_000_000_000n;
    const frac = planck % 1_000_000_000_000n;
    const fracStr = frac.toString().padStart(12, "0").replace(/0+$/, "");
    return `${whole}${fracStr ? "." + fracStr : ""} PAS`;
}

async function readBalance(wss: string) {
    const client = createClient(getWsProvider(wss));
    try {
        const api = client.getUnsafeApi();
        const account = await api.query.System.Account.getValue(ADDRESS);
        return {
            free: BigInt(account.data.free ?? 0n),
            reserved: BigInt(account.data.reserved ?? 0n),
            frozen: BigInt(account.data.frozen ?? 0n),
        };
    } finally {
        try { client.destroy(); } catch {}
    }
}

console.log(`Address: ${ADDRESS}\n`);
for (const chain of CHAINS) {
    process.stdout.write(`${chain.label}\n  ${chain.wss}\n`);
    try {
        const r = await readBalance(chain.wss);
        console.log(`  free:     ${fmtPas(r.free)}   (${r.free} planck)`);
        console.log(`  reserved: ${fmtPas(r.reserved)}`);
        console.log(`  frozen:   ${fmtPas(r.frozen)}\n`);
    } catch (err) {
        console.log(`  ERROR: ${err instanceof Error ? err.message : String(err)}\n`);
    }
}
process.exit(0);
