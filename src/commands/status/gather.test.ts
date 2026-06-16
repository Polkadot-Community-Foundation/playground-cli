// Copyright (C) Parity Technologies (UK) Ltd.
// SPDX-License-Identifier: Apache-2.0

import { describe, it, expect } from "vitest";
import { buildStatusReport, type StatusReaders } from "./gather.js";

const ADDRESSES = {
    rootAddress: "5Root",
    productAddress: "5Product",
    productH160: "0xabc" as `0x${string}`,
};

// Minimal fakes — buildStatusReport never inspects these beyond passing them to
// the readers, so opaque sentinels are enough.
const handle = { addresses: ADDRESSES, adapter: {} } as never;
const client = {} as never;

function readers(overrides: Partial<StatusReaders> = {}): StatusReaders {
    return {
        readNativeBalance: async () => 7n,
        readPgas: async () => 50n,
        readBulletinAuth: async () => ({ text: "~2d 3h  ·  #1,234,567", tone: "default" }),
        readLoginStampMs: async () => 1_700_000_000_000,
        ...overrides,
    };
}

describe("buildStatusReport", () => {
    it("collects every field when all reads succeed", async () => {
        const report = await buildStatusReport(handle, client, readers());
        expect(report.addresses).toBe(ADDRESSES);
        expect(report.nativeBalance).toEqual({ ok: true, value: 7n });
        expect(report.pgas).toEqual({ ok: true, value: 50n });
        expect(report.bulletin).toEqual({
            ok: true,
            value: { text: "~2d 3h  ·  #1,234,567", tone: "default" },
        });
        expect(report.loginStampMs).toBe(1_700_000_000_000);
    });

    it("marks a field unavailable when its read throws", async () => {
        const report = await buildStatusReport(
            handle,
            client,
            readers({
                readPgas: async () => {
                    throw new Error("ws down");
                },
            }),
        );
        expect(report.pgas).toEqual({ ok: false });
        expect(report.nativeBalance).toEqual({ ok: true, value: 7n });
    });

    it("represents not-granted Bulletin as ok:true with null value", async () => {
        const report = await buildStatusReport(
            handle,
            client,
            readers({ readBulletinAuth: async () => null }),
        );
        expect(report.bulletin).toEqual({ ok: true, value: null });
    });

    it("marks every chain field unavailable when the client is null", async () => {
        const report = await buildStatusReport(handle, null, readers());
        expect(report.nativeBalance).toEqual({ ok: false });
        expect(report.pgas).toEqual({ ok: false });
        expect(report.bulletin).toEqual({ ok: false });
        expect(report.loginStampMs).toBe(1_700_000_000_000);
    });

    it("tolerates a null login stamp", async () => {
        const report = await buildStatusReport(
            handle,
            client,
            readers({ readLoginStampMs: async () => null }),
        );
        expect(report.loginStampMs).toBeNull();
    });

    it("never rejects when the login stamp read throws", async () => {
        const report = await buildStatusReport(
            handle,
            client,
            readers({
                readLoginStampMs: async () => {
                    throw new Error("fs error");
                },
            }),
        );
        expect(report.loginStampMs).toBeNull();
    });
});
