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
 * One-shot operator helper: print the SS58 address `bulletinTopUp.ts`
 * derives (under both prefix 0 / prefix 42 encodings of the same key) so an
 * operator can faucet-fund / teleport PAS to it. Run via:
 *   bun run tools/print-bulletin-dev-address.ts
 *
 * Mnemonic and derivation must stay in sync with
 * `src/utils/account/bulletinTopUp.ts::BULLETIN_DEV_MNEMONIC`. The companion
 * `tools/check-bulletin-funder.ts` queries this address's balance.
 */

import { seedToAccount } from "@parity/product-sdk-keys";
import { ss58Encode } from "@parity/product-sdk-address";

const MNEMONIC = "bottom drive obey lake curtain smoke basket hold race lonely fit walk";

const account = seedToAccount(MNEMONIC, "");
const hex = `0x${Buffer.from(account.publicKey).toString("hex")}`;
const generic = ss58Encode(account.publicKey, 42);
const polkadot = ss58Encode(account.publicKey, 0);

console.log("Public key (hex):", hex);
console.log("SS58 (generic prefix 42, Westend/Substrate dev):", generic);
console.log("SS58 (Polkadot/Paseo prefix 0):", polkadot);
console.log("Default SS58 from seedToAccount:", account.ss58Address);
