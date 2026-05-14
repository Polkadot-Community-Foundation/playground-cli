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
 * Tests for the bulletin-deploy-style dev top-up.
 *
 * We mock `@parity/product-sdk-tx::submitAndWatch` to observe what got
 * submitted without touching the network. The real `polkadot-api` `Enum(...)`
 * is used so changes to the `Balances.transfer_allow_death` dest variant
 * ("Id" vs "Index" etc.) fail loudly.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

const mockSubmitAndWatch = vi
    .fn<(tx: unknown, signer: unknown, options?: unknown) => Promise<unknown>>()
    .mockResolvedValue({
        ok: true,
    });

vi.mock("@parity/product-sdk-tx", () => ({
    submitAndWatch: (...args: unknown[]) =>
        mockSubmitAndWatch(args[0], args[1] as unknown, args[2] as unknown),
}));

const { topUpFromBulletinDev, DevFunderExhaustedError } = await import("./bulletinTopUp.js");

const RECIPIENT = "5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY";
// SS58 of the bare-master account derived from the standard dev mnemonic with
// empty derivation; see the pubkey assertion at the bottom of the file.
const DEV_FUNDER = "5DfhGyQdFobKM8NsWvEeAKk5EQQgYe9AydgJ7rMB6E1EqRzV";
const ONE_PAS = 1_000_000_000_000n;
const SKIP_FLOOR = 100_000_000_000n;
const SOURCE_BUFFER = 1_000_000_000_000n;
const FUNDER_REQUIRED = ONE_PAS + SOURCE_BUFFER;
// Plenty of headroom so the preflight balance check passes in tests that
// expect the transfer to fire. Bumping this on a real change to the buffer
// would require revisiting `bulletinTopUp.ts::SOURCE_BUFFER` first.
const FUNDER_HEALTHY = FUNDER_REQUIRED * 10n;

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

describe("topUpFromBulletinDev", () => {
    it("skips the transfer when the recipient is already at the floor (>= check)", async () => {
        // Exact-floor boundary: `recipient.free >= SKIP_TRANSFER_THRESHOLD`
        // SKIPS. If a future refactor flips the inequality this test fails.
        const { client, transferFactory } = makeClient({
            [RECIPIENT]: SKIP_FLOOR,
            [DEV_FUNDER]: FUNDER_HEALTHY,
        });
        const result = await topUpFromBulletinDev(client, RECIPIENT);
        expect(result).toEqual({ skipped: true });
        expect(transferFactory).not.toHaveBeenCalled();
        expect(mockSubmitAndWatch).not.toHaveBeenCalled();
    });

    it("sends 1 PAS via transfer_allow_death when below the floor", async () => {
        const { client, transferFactory } = makeClient({
            [RECIPIENT]: SKIP_FLOOR - 1n,
            [DEV_FUNDER]: FUNDER_HEALTHY,
        });
        const result = await topUpFromBulletinDev(client, RECIPIENT);
        expect(result).toEqual({ skipped: false, transferred: ONE_PAS });
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

    it("tops up a zero-balance recipient when the funder is healthy", async () => {
        const { client, transferFactory } = makeClient({ [DEV_FUNDER]: FUNDER_HEALTHY });
        const result = await topUpFromBulletinDev(client, RECIPIENT);
        expect(result.skipped).toBe(false);
        expect(transferFactory).toHaveBeenCalledTimes(1);
    });

    it("short-circuits without submitting if the recipient IS the dev funder", async () => {
        // Hypothetical: a user's product-derived account collides with the
        // bare-master dev address. Mirrors bulletin-deploy's
        // `attemptTestnetTopUp` self-transfer guard.
        const { client, transferFactory } = makeClient({ [DEV_FUNDER]: 0n });
        const result = await topUpFromBulletinDev(client, DEV_FUNDER);
        expect(result).toEqual({ skipped: true });
        expect(transferFactory).not.toHaveBeenCalled();
        expect(mockSubmitAndWatch).not.toHaveBeenCalled();
    });

    it("throws DevFunderExhaustedError before broadcasting when the funder is low", async () => {
        // Funder free balance is below the `ONE_PAS + SOURCE_BUFFER` floor.
        // The error must fire BEFORE `submitAndWatch` so we don't spam the
        // chain with reverting transfers.
        const { client, transferFactory } = makeClient({
            [RECIPIENT]: 0n,
            [DEV_FUNDER]: FUNDER_REQUIRED - 1n,
        });
        await expect(topUpFromBulletinDev(client, RECIPIENT)).rejects.toBeInstanceOf(
            DevFunderExhaustedError,
        );
        expect(transferFactory).not.toHaveBeenCalled();
        expect(mockSubmitAndWatch).not.toHaveBeenCalled();
    });

    it("DevFunderExhaustedError carries the funder address and required amount", async () => {
        const { client } = makeClient({
            [RECIPIENT]: 0n,
            [DEV_FUNDER]: 0n,
        });
        try {
            await topUpFromBulletinDev(client, RECIPIENT);
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
        await topUpFromBulletinDev(client, RECIPIENT);
        const [, signer] = mockSubmitAndWatch.mock.calls[0];
        // biome-ignore lint/suspicious/noExplicitAny: signer shape mocked
        const pubkey = (signer as any).publicKey as Uint8Array;
        expect(pubkey).toBeInstanceOf(Uint8Array);
        expect(pubkey.length).toBe(32);
        // Positive lock: full pubkey for the bare master account of the
        // standard dev mnemonic ("bottom drive ..." with empty derivation,
        // sr25519). Verified live via `bun run tools/print-bulletin-dev-address.ts`.
        // If `BULLETIN_DEV_MNEMONIC` or the derivation path ever changes,
        // this assertion fails loudly instead of letting the CLI silently
        // point at an unfunded address.
        const expectedBareMaster =
            "46ebddef8cd9bb167dc30878d7113b7e168e6f0646beffd77d69d39bad76b47a";
        expect(Buffer.from(pubkey).toString("hex")).toBe(expectedBareMaster);
        // Negative guard: canonical `//Alice` is a common typo / regression
        // ("Alice" the label, `//Alice` the derivation). It is unfunded on
        // paseo-next-v2 and must never be used here.
        const canonicalAliceFirstFour = "d43593c7";
        expect(Buffer.from(pubkey.slice(0, 4)).toString("hex")).not.toBe(canonicalAliceFirstFour);
    });
});
