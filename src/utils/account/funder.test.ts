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
 * Pins the `MASTER_FUNDER_SEED` gating of the dedicated funder. The seed is
 * read at module load, so each case sets/clears the env var, resets the module
 * registry, and re-imports `./funder.js` to re-derive the chain.
 *
 * Any valid BIP-39 phrase works; we reuse the well-known substrate dev phrase
 * (also used in other test files) purely because it is a guaranteed-valid
 * mnemonic — it is NOT the real funder seed, which only ever comes from the
 * secret.
 */

import { describe, it, expect, afterEach, vi } from "vitest";

const VALID_MNEMONIC = "bottom drive obey lake curtain smoke basket hold race lonely fit walk";

afterEach(() => {
    delete process.env.MASTER_FUNDER_SEED;
    vi.resetModules();
});

describe("FUNDER_CHAIN dedicated-funder gating", () => {
    it("omits the dedicated funder when MASTER_FUNDER_SEED is unset", async () => {
        delete process.env.MASTER_FUNDER_SEED;
        vi.resetModules();
        const { FUNDER_CHAIN, DEDICATED_FUNDER_ADDRESS } = await import("./funder.js");

        expect(FUNDER_CHAIN.map((f) => f.name)).toEqual(["Alice"]);
        expect(DEDICATED_FUNDER_ADDRESS).toBeNull();
    });

    it("prepends the dedicated funder (primary) ahead of Alice when MASTER_FUNDER_SEED is set", async () => {
        process.env.MASTER_FUNDER_SEED = VALID_MNEMONIC;
        vi.resetModules();
        const { FUNDER_CHAIN, DEDICATED_FUNDER_ADDRESS } = await import("./funder.js");

        // Dedicated funder is tried first; Alice is the fallback.
        expect(FUNDER_CHAIN.map((f) => f.name)).toEqual(["dedicated", "Alice"]);
        // Address is derived from the seed and matches the leading chain entry.
        expect(DEDICATED_FUNDER_ADDRESS).toMatch(/^5/);
        expect(FUNDER_CHAIN[0]?.address).toBe(DEDICATED_FUNDER_ADDRESS);
    });

    it("trims surrounding whitespace before deriving", async () => {
        process.env.MASTER_FUNDER_SEED = `  ${VALID_MNEMONIC}  `;
        vi.resetModules();
        const { DEDICATED_FUNDER_ADDRESS } = await import("./funder.js");

        expect(DEDICATED_FUNDER_ADDRESS).not.toBeNull();
    });

    it("treats a blank MASTER_FUNDER_SEED as unset", async () => {
        process.env.MASTER_FUNDER_SEED = "   ";
        vi.resetModules();
        const { FUNDER_CHAIN, DEDICATED_FUNDER_ADDRESS } = await import("./funder.js");

        expect(FUNDER_CHAIN.map((f) => f.name)).toEqual(["Alice"]);
        expect(DEDICATED_FUNDER_ADDRESS).toBeNull();
    });
});
