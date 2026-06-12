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
 * Tests for the `playground drip` dev top-up.
 *
 * We mock `@parity/product-sdk-tx::submitAndWatch` to observe what got
 * submitted without touching the network. The real `polkadot-api` `Enum(...)`
 * is used so changes to the `Balances.transfer_allow_death` dest variant
 * ("Id" vs "Index" etc.) fail loudly.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

const mockSubmitAndWatch = vi
    .fn<(tx: unknown, signer: unknown, options?: unknown) => Promise<unknown>>()
    .mockResolvedValue({ ok: true });

vi.mock("@parity/product-sdk-tx", () => ({
    submitAndWatch: (...args: unknown[]) =>
        mockSubmitAndWatch(args[0], args[1] as unknown, args[2] as unknown),
}));

const { dripToProductAccount, DevFunderExhaustedError, DRIP_AMOUNT, DRIP_CAP, formatPas } =
    await import("./drip.js");

const RECIPIENT = "5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY";
// SS58 of the bare-master account derived from the standard dev mnemonic with
// empty derivation; see the pubkey assertion at the bottom of the file.
const DEV_FUNDER = "5DfhGyQdFobKM8NsWvEeAKk5EQQgYe9AydgJ7rMB6E1EqRzV";
const ONE_PAS = 1_000_000_000_000n;
const SOURCE_BUFFER = ONE_PAS;
const FUNDER_REQUIRED = DRIP_AMOUNT + SOURCE_BUFFER;
// Plenty of headroom so the preflight balance check passes in tests that
// expect the transfer to fire.
const FUNDER_HEALTHY = FUNDER_REQUIRED * 100n;

function makeClient(balances: Record<string, bigint>) {
    const transferFactory = vi.fn().mockImplementation((args: unknown) => ({
        __kind: "transfer_allow_death",
        args,
    }));
    const getValue = vi.fn().mockImplementation(async (address: string) => ({
        data: { free: balances[address] ?? 0n, reserved: 0n, frozen: 0n },
    }));
    return {
        client: {
            assetHub: {
                query: {
                    System: {
                        Account: { getValue },
                    },
                },
                tx: {
                    Balances: {
                        transfer_allow_death: transferFactory,
                    },
                },
            },
            // biome-ignore lint/suspicious/noExplicitAny: minimal PaseoClient shape for the unit under test
        } as any,
        transferFactory,
        getValue,
    };
}

beforeEach(() => {
    mockSubmitAndWatch.mockClear();
});

describe("dripToProductAccount", () => {
    it("skips the transfer when the recipient is already at the cap (>= check)", async () => {
        // Exact-cap boundary: `recipient.free >= DRIP_CAP` SKIPS. If a future
        // refactor flips the inequality this test fails.
        const { client, transferFactory } = makeClient({
            [RECIPIENT]: DRIP_CAP,
            [DEV_FUNDER]: FUNDER_HEALTHY,
        });
        const result = await dripToProductAccount(client, RECIPIENT);
        expect(result).toEqual({ skipped: true, balance: DRIP_CAP });
        expect(transferFactory).not.toHaveBeenCalled();
        expect(mockSubmitAndWatch).not.toHaveBeenCalled();
    });

    it("sends 1 PAS via transfer_allow_death when below the cap", async () => {
        const { client, transferFactory } = makeClient({
            [RECIPIENT]: DRIP_CAP - 1n,
            [DEV_FUNDER]: FUNDER_HEALTHY,
        });
        const result = await dripToProductAccount(client, RECIPIENT);
        expect(result).toEqual({ skipped: false, transferred: ONE_PAS, balance: DRIP_CAP - 1n });
        expect(transferFactory).toHaveBeenCalledTimes(1);
        const [args] = transferFactory.mock.calls[0];
        expect(args).toMatchObject({
            dest: { type: "Id", value: RECIPIENT },
            value: ONE_PAS,
        });
        expect(mockSubmitAndWatch).toHaveBeenCalledTimes(1);
        const [, , options] = mockSubmitAndWatch.mock.calls[0];
        expect(options).toEqual({ waitFor: "finalized" });
    });

    it("sends only 1 PAS at a time even far below the cap", async () => {
        // A near-empty account still receives exactly one DRIP_AMOUNT, never a
        // top-up-to-cap lump sum — the user drips repeatedly to climb.
        const { client } = makeClient({ [RECIPIENT]: 0n, [DEV_FUNDER]: FUNDER_HEALTHY });
        const result = await dripToProductAccount(client, RECIPIENT);
        expect(result).toEqual({ skipped: false, transferred: ONE_PAS, balance: 0n });
    });

    it("short-circuits without submitting if the recipient IS the dev funder", async () => {
        const { client, transferFactory } = makeClient({ [DEV_FUNDER]: 0n });
        const result = await dripToProductAccount(client, DEV_FUNDER);
        expect(result).toEqual({ skipped: true, balance: 0n });
        expect(transferFactory).not.toHaveBeenCalled();
        expect(mockSubmitAndWatch).not.toHaveBeenCalled();
    });

    it("throws DevFunderExhaustedError before broadcasting when the funder is low", async () => {
        const { client, transferFactory } = makeClient({
            [RECIPIENT]: 0n,
            [DEV_FUNDER]: FUNDER_REQUIRED - 1n,
        });
        await expect(dripToProductAccount(client, RECIPIENT)).rejects.toBeInstanceOf(
            DevFunderExhaustedError,
        );
        expect(transferFactory).not.toHaveBeenCalled();
        expect(mockSubmitAndWatch).not.toHaveBeenCalled();
    });

    it("DevFunderExhaustedError carries the funder address and required amount", async () => {
        const { client } = makeClient({ [RECIPIENT]: 0n, [DEV_FUNDER]: 0n });
        try {
            await dripToProductAccount(client, RECIPIENT);
            throw new Error("should have thrown");
        } catch (err) {
            expect(err).toBeInstanceOf(DevFunderExhaustedError);
            const e = err as InstanceType<typeof DevFunderExhaustedError>;
            expect(e.address).toBe(DEV_FUNDER);
            expect(e.required).toBe(FUNDER_REQUIRED);
            expect(e.free).toBe(0n);
        }
    });

    it("signs the transfer with the bare-master pubkey, NOT //Alice", async () => {
        const { client } = makeClient({ [DEV_FUNDER]: FUNDER_HEALTHY });
        await dripToProductAccount(client, RECIPIENT);
        const [, signer] = mockSubmitAndWatch.mock.calls[0];
        // biome-ignore lint/suspicious/noExplicitAny: signer shape mocked
        const pubkey = (signer as any).publicKey as Uint8Array;
        expect(pubkey).toBeInstanceOf(Uint8Array);
        expect(pubkey.length).toBe(32);
        // Positive lock: full pubkey for the bare master account of the
        // standard dev mnemonic ("bottom drive ..." with empty derivation,
        // sr25519). If `DEV_MNEMONIC` or the derivation path ever changes, this
        // fails loudly instead of letting the CLI point at an unfunded address.
        const expectedBareMaster =
            "46ebddef8cd9bb167dc30878d7113b7e168e6f0646beffd77d69d39bad76b47a";
        expect(Buffer.from(pubkey).toString("hex")).toBe(expectedBareMaster);
        // Negative guard: canonical `//Alice` is unfunded on paseo-next-v2 and
        // must never be used here.
        const canonicalAliceFirstFour = "d43593c7";
        expect(Buffer.from(pubkey.slice(0, 4)).toString("hex")).not.toBe(canonicalAliceFirstFour);
    });
});

describe("formatPas", () => {
    it("renders whole amounts without a fraction", () => {
        expect(formatPas(0n)).toBe("0 PAS");
        expect(formatPas(ONE_PAS)).toBe("1 PAS");
        expect(formatPas(DRIP_CAP)).toBe("10 PAS");
    });

    it("trims trailing zeros and caps at 4 fractional digits", () => {
        expect(formatPas(ONE_PAS + ONE_PAS / 2n)).toBe("1.5 PAS");
        // 0.123456 PAS -> truncated to 4 dp
        expect(formatPas(123_456_000_000n)).toBe("0.1234 PAS");
    });
});
