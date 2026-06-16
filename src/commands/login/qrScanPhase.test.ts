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

import { describe, expect, test, vi } from "vitest";
import { eraseBlockSequence, runQrScanPhase, scanStatusLabel } from "./qrScanPhase.js";
import type { LoginHandle, LoginStatus, SessionAddresses } from "../../utils/auth.js";

const ADDR: SessionAddresses = {
    rootAddress: "root",
    productAddress: "prod",
    productH160: "0xabc",
};

function fakeOut(isTTY: boolean) {
    const writes: string[] = [];
    return {
        writes,
        stream: {
            write: (s: string) => {
                writes.push(s);
            },
            isTTY,
        },
    };
}

function fakeLogin(): LoginHandle {
    // The adapter/authPromise are never touched: we inject waitForLogin.
    return { adapter: {}, authPromise: Promise.resolve() } as unknown as LoginHandle;
}

describe("eraseBlockSequence", () => {
    test("is empty for a zero-line block", () => {
        expect(eraseBlockSequence(0)).toBe("");
    });

    test("clears in place for a single-line block", () => {
        expect(eraseBlockSequence(1)).toBe("\r\x1b[0J");
    });

    test("moves up (lines - 1) and clears to end of screen", () => {
        expect(eraseBlockSequence(5)).toBe("\r\x1b[4A\x1b[0J");
    });
});

describe("scanStatusLabel", () => {
    test("prompts to scan while waiting", () => {
        expect(scanStatusLabel({ step: "waiting" })).toMatch(/scan/i);
    });

    test("shows a friendly syncing message while pending, not the raw host stage", () => {
        // The host emits internal CamelCase stage names ("AllowanceAllocation",
        // etc.); users should never see those — surface a friendly umbrella.
        expect(scanStatusLabel({ step: "pending", stage: "AllowanceAllocation" })).toBe("syncing…");
        expect(scanStatusLabel({ step: "pending", stage: "anything" })).toBe("syncing…");
    });

    test("shows a finalizing message once paired", () => {
        expect(scanStatusLabel({ step: "paired" })).toMatch(/finaliz/i);
    });

    test("surfaces the error message", () => {
        expect(scanStatusLabel({ step: "error", message: "boom" })).toBe("boom");
    });
});

describe("runQrScanPhase", () => {
    const qr = "ROW1\nROW2\nROW3\n"; // 3 QR rows

    test("prints the caption + QR, returns addresses, then erases the whole block (TTY)", async () => {
        const { writes, stream } = fakeOut(true);
        const waitForLoginFn = async (
            _h: LoginHandle,
            onStatus: (s: LoginStatus) => void,
        ): Promise<string | null> => {
            onStatus({ step: "waiting" });
            onStatus({ step: "paired" });
            onStatus({ step: "success", address: ADDR.productAddress, addresses: ADDR });
            return ADDR.productAddress;
        };

        const res = await runQrScanPhase(fakeLogin(), qr, {
            out: stream,
            waitForLoginFn,
            animate: false,
        });

        const all = writes.join("");
        expect(all).toContain("Scan with the Polkadot mobile app to log in:");
        expect(all).toContain("ROW1");
        expect(all).toContain("ROW3");
        expect(res.addresses).toEqual(ADDR);
        expect(res.error).toBeNull();
        // Block = caption + blank + 3 QR rows + blank + status line = 7 lines.
        // The final write must erase exactly that block.
        expect(writes[writes.length - 1]).toBe(eraseBlockSequence(7));
    });

    test("captures a login error but still erases the block", async () => {
        const { writes, stream } = fakeOut(true);
        const waitForLoginFn = async (
            _h: LoginHandle,
            onStatus: (s: LoginStatus) => void,
        ): Promise<string | null> => {
            onStatus({ step: "waiting" });
            onStatus({ step: "error", message: "nope" });
            return null;
        };

        const res = await runQrScanPhase(fakeLogin(), qr, {
            out: stream,
            waitForLoginFn,
            animate: false,
        });

        expect(res.addresses).toBeNull();
        expect(res.error).toBe("nope");
        expect(writes[writes.length - 1]).toBe(eraseBlockSequence(7));
    });

    test("never throws and still erases the block if login rejects mid-flight", async () => {
        // waitForLogin has no catch internally — an authPromise rejection or a
        // loadSessions throw propagates out. If the erase lived outside the
        // try/finally, the QR would be left stranded on screen. It must not.
        const { writes, stream } = fakeOut(true);
        const waitForLoginFn = async (
            _h: LoginHandle,
            onStatus: (s: LoginStatus) => void,
        ): Promise<string | null> => {
            onStatus({ step: "waiting" });
            throw new Error("ws dropped");
        };

        const res = await runQrScanPhase(fakeLogin(), qr, {
            out: stream,
            waitForLoginFn,
            animate: false,
        });

        expect(res.addresses).toBeNull();
        expect(res.error).toBe("ws dropped");
        expect(writes[writes.length - 1]).toBe(eraseBlockSequence(7));
    });

    test("animated spinner starts a timer and clears it (no leaked interval)", async () => {
        const setSpy = vi.spyOn(globalThis, "setInterval");
        const clearSpy = vi.spyOn(globalThis, "clearInterval");
        const { stream } = fakeOut(true);
        const waitForLoginFn = async (
            _h: LoginHandle,
            onStatus: (s: LoginStatus) => void,
        ): Promise<string | null> => {
            onStatus({ step: "waiting" });
            onStatus({ step: "success", address: ADDR.productAddress, addresses: ADDR });
            return ADDR.productAddress;
        };

        await runQrScanPhase(fakeLogin(), qr, { out: stream, waitForLoginFn, animate: true });

        expect(setSpy).toHaveBeenCalledTimes(1);
        expect(clearSpy).toHaveBeenCalledTimes(1);
        setSpy.mockRestore();
        clearSpy.mockRestore();
    });

    test("emits no ANSI escapes off a TTY (pipe-safe)", async () => {
        const { writes, stream } = fakeOut(false);
        const waitForLoginFn = async (
            _h: LoginHandle,
            onStatus: (s: LoginStatus) => void,
        ): Promise<string | null> => {
            onStatus({ step: "waiting" });
            onStatus({ step: "success", address: ADDR.productAddress, addresses: ADDR });
            return ADDR.productAddress;
        };

        await runQrScanPhase(fakeLogin(), qr, { out: stream, waitForLoginFn, animate: false });

        const all = writes.join("");
        expect(all).not.toContain("\x1b[");
        expect(all).toContain("ROW2");
    });
});
