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

import { beforeEach, describe, expect, it, vi } from "vitest";

// Boundary mocks: the gate composes session lookup (auth.ts) + a read-only
// registry dry-run (registry.ts). We never want a real adapter / network here.
const { findSessionMock, deriveSessionAddressesMock, getReadOnlyRegistryContractMock } = vi.hoisted(
    () => ({
        findSessionMock: vi.fn(),
        deriveSessionAddressesMock: vi.fn(),
        getReadOnlyRegistryContractMock: vi.fn(),
    }),
);

vi.mock("../auth.js", () => ({
    findSession: findSessionMock,
    deriveSessionAddresses: deriveSessionAddressesMock,
}));

vi.mock("../registry.js", () => ({
    getReadOnlyRegistryContract: getReadOnlyRegistryContractMock,
}));

import { checkIdentityGate, isAnonymousRoot } from "./identityGate.js";

const ZERO = ("0x" + "00".repeat(32)) as `0x${string}`;
const REVEALED = ("0x" + "11".repeat(32)) as `0x${string}`;
const H160 = "0xbeefbeefbeefbeefbeefbeefbeefbeefbeefbeef" as `0x${string}`;

function fakeHandle() {
    const destroy = vi.fn().mockResolvedValue(undefined);
    return { adapter: { destroy }, address: "5x", session: { rootAccountId: new Uint8Array(32) } };
}

function fakeRegistry(
    query: (addr: `0x${string}`) => Promise<{ success: boolean; value?: unknown }>,
) {
    return { getRootAccount: { query: vi.fn(query) } };
}

const FAST = { attempts: 2, delayMs: 0 };

beforeEach(() => {
    vi.clearAllMocks();
    deriveSessionAddressesMock.mockReturnValue({
        rootAddress: "5Root",
        productAddress: "5Prod",
        productH160: H160,
    });
});

describe("isAnonymousRoot", () => {
    it("treats the 32-zero-byte hex sentinel as anonymous", () => {
        expect(isAnonymousRoot(ZERO)).toBe(true);
        expect(isAnonymousRoot("0X" + "00".repeat(32))).toBe(true);
        expect(isAnonymousRoot("00".repeat(32))).toBe(true); // no 0x prefix
        expect(isAnonymousRoot("0x")).toBe(true); // empty body
    });

    it("treats a non-zero root as revealed", () => {
        expect(isAnonymousRoot(REVEALED)).toBe(false);
        expect(isAnonymousRoot("0x" + "00".repeat(31) + "01")).toBe(false);
        expect(
            isAnonymousRoot("0xAbC0000000000000000000000000000000000000000000000000000000000000"),
        ).toBe(false);
    });

    it("handles byte-array representations", () => {
        expect(isAnonymousRoot(new Uint8Array(32))).toBe(true);
        const nonZero = new Uint8Array(32);
        nonZero[31] = 1;
        expect(isAnonymousRoot(nonZero)).toBe(false);
        expect(isAnonymousRoot([0, 0, 0])).toBe(true);
        expect(isAnonymousRoot([0, 1, 0])).toBe(false);
    });

    it("treats null/undefined as anonymous", () => {
        expect(isAnonymousRoot(null)).toBe(true);
        expect(isAnonymousRoot(undefined)).toBe(true);
    });

    it("throws on an unrecognized representation (forces unverifiable upstream)", () => {
        expect(() => isAnonymousRoot(5 as unknown)).toThrow();
        expect(() => isAnonymousRoot({} as unknown)).toThrow();
    });
});

describe("checkIdentityGate", () => {
    it("returns not-logged-in and never reads the registry when no session exists", async () => {
        findSessionMock.mockResolvedValue(null);

        const result = await checkIdentityGate({} as any, FAST);

        expect(result).toEqual({ status: "not-logged-in" });
        expect(getReadOnlyRegistryContractMock).not.toHaveBeenCalled();
    });

    it("returns revealed for a non-zero root and releases the session adapter", async () => {
        const handle = fakeHandle();
        findSessionMock.mockResolvedValue(handle);
        getReadOnlyRegistryContractMock.mockResolvedValue(
            fakeRegistry(async () => ({ success: true, value: REVEALED })),
        );

        const result = await checkIdentityGate({} as any, FAST);

        expect(result).toEqual({ status: "revealed", productH160: H160 });
        expect(handle.adapter.destroy).toHaveBeenCalledTimes(1);
    });

    it("returns anonymous for the zero-root sentinel and releases the adapter", async () => {
        const handle = fakeHandle();
        findSessionMock.mockResolvedValue(handle);
        getReadOnlyRegistryContractMock.mockResolvedValue(
            fakeRegistry(async () => ({ success: true, value: ZERO })),
        );

        const result = await checkIdentityGate({} as any, FAST);

        expect(result).toEqual({ status: "anonymous", productH160: H160 });
        expect(handle.adapter.destroy).toHaveBeenCalledTimes(1);
    });

    it("returns unverifiable when the dry-run fails on every attempt", async () => {
        const handle = fakeHandle();
        findSessionMock.mockResolvedValue(handle);
        const registry = fakeRegistry(async () => ({ success: false }));
        getReadOnlyRegistryContractMock.mockResolvedValue(registry);

        const result = await checkIdentityGate({} as any, FAST);

        expect(result.status).toBe("unverifiable");
        expect(registry.getRootAccount.query).toHaveBeenCalledTimes(2); // retried
        expect(handle.adapter.destroy).toHaveBeenCalledTimes(1);
    });

    it("returns unverifiable when the query throws", async () => {
        const handle = fakeHandle();
        findSessionMock.mockResolvedValue(handle);
        getReadOnlyRegistryContractMock.mockResolvedValue(
            fakeRegistry(async () => {
                throw new Error("RPC down");
            }),
        );

        const result = await checkIdentityGate({} as any, FAST);

        expect(result.status).toBe("unverifiable");
        expect(handle.adapter.destroy).toHaveBeenCalledTimes(1);
    });

    it("uses an injected registry without re-resolving its own", async () => {
        const handle = fakeHandle();
        findSessionMock.mockResolvedValue(handle);
        const registry = fakeRegistry(async () => ({ success: true, value: REVEALED }));

        const result = await checkIdentityGate({} as any, { ...FAST, registry });

        expect(result).toEqual({ status: "revealed", productH160: H160 });
        expect(registry.getRootAccount.query).toHaveBeenCalledTimes(1);
        expect(getReadOnlyRegistryContractMock).not.toHaveBeenCalled();
    });

    it("returns unverifiable (and releases the adapter) when the session can't be derived", async () => {
        const handle = fakeHandle();
        findSessionMock.mockResolvedValue(handle);
        deriveSessionAddressesMock.mockImplementation(() => {
            throw new Error("bad session");
        });

        const result = await checkIdentityGate({} as any, FAST);

        expect(result.status).toBe("unverifiable");
        expect(handle.adapter.destroy).toHaveBeenCalledTimes(1);
        expect(getReadOnlyRegistryContractMock).not.toHaveBeenCalled();
    });
});
