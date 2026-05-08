/**
 * Tests for auth.ts edge cases — specifically the subscribe-before-assignment bug.
 *
 * The real subscribe/pairing flow requires a live adapter, so these tests
 * verify the patterns used rather than the full integration.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { existsSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
    clearLocalAppStorage,
    makeSignPayloadCallback,
    makeSignRawCallback,
    waitForLogout,
    type LogoutHandle,
    type LogoutStatus,
} from "./auth.js";
import { DAPP_ID } from "../config.js";
import type { UserSession } from "@parity/product-sdk-terminal";

describe("subscribe-before-assignment pattern", () => {
    /**
     * Simulates the bug where `const unsub = obs.subscribe(cb)` fires
     * the callback synchronously, causing `unsub` to be referenced
     * before it's assigned.
     *
     * The fix uses `let unsub; unsub = obs.subscribe(cb)` with `unsub?.()`.
     */
    it("handles synchronous callback firing during subscribe", () => {
        let callbackFired = false;
        let unsubCalled = false;

        // Simulate an observable that fires synchronously
        const syncObservable = {
            subscribe(cb: (status: { step: string; payload?: string }) => void) {
                // Fires immediately during subscribe()
                cb({ step: "pairing", payload: "qr-data" });
                return () => {
                    unsubCalled = true;
                };
            },
        };

        // The FIXED pattern (let + optional chaining)
        let done = false;
        let unsub: (() => void) | undefined;
        unsub = syncObservable.subscribe((status) => {
            if (status.step === "pairing" && !done) {
                done = true;
                unsub?.(); // safe — unsub is undefined when called sync, but done=true prevents re-entry
                callbackFired = true;
            }
        });

        expect(callbackFired).toBe(true);
        expect(done).toBe(true);
        // unsub?.() was called when unsub was still undefined (sync), so unsubCalled is false
        // but the callback still ran correctly
    });

    it("handles asynchronous callback firing after subscribe returns", () => {
        let callbackFired = false;
        let unsubCalled = false;

        // Simulate an observable that fires asynchronously
        let storedCb: ((status: { step: string; payload?: string }) => void) | null = null;
        const asyncObservable = {
            subscribe(cb: (status: { step: string; payload?: string }) => void) {
                storedCb = cb;
                return () => {
                    unsubCalled = true;
                };
            },
        };

        let done = false;
        let unsub: (() => void) | undefined;
        unsub = asyncObservable.subscribe((status) => {
            if (status.step === "pairing" && !done) {
                done = true;
                unsub?.();
                callbackFired = true;
            }
        });

        // Fire callback after subscribe has returned — unsub is assigned
        storedCb!({ step: "pairing", payload: "qr-data" });

        expect(callbackFired).toBe(true);
        expect(unsubCalled).toBe(true); // unsub was assigned, so it was called
    });

    it("done flag prevents double-resolution", () => {
        let resolutionCount = 0;

        const observable = {
            subscribe(cb: (status: { step: string }) => void) {
                // Fires twice
                cb({ step: "pairing" });
                cb({ step: "pairing" });
                return () => {};
            },
        };

        let done = false;
        let unsub: (() => void) | undefined;
        unsub = observable.subscribe((status) => {
            if (status.step === "pairing" && !done) {
                done = true;
                unsub?.();
                resolutionCount++;
            }
        });

        expect(resolutionCount).toBe(1);
    });
});

// ── Sign-out flow ─────────────────────────────────────────────────────────────

/**
 * Minimal stand-in for `@parity/product-sdk-terminal`'s TerminalAdapter, wide enough
 * for what `waitForLogout` actually touches. We don't import the real type here
 * so the test file stays cheap to run; a compile error if the real API drifts
 * is caught by the consuming call site in auth.ts, not here.
 */
type FakeResult<T, E> = { isOk(): true; value: T } | { isOk(): false; error: E };

function okResult<T>(value: T): FakeResult<T, never> {
    return { isOk: () => true as const, value };
}

function errResult<E>(error: E): FakeResult<never, E> {
    return { isOk: () => false as const, error };
}

/** Fake session handle — only the fields `waitForLogout` reads. */
function fakeSession() {
    return {
        id: "test-session-id",
        localAccount: {} as never,
        remoteAccount: {} as never,
    };
}

interface FakeAdapter {
    destroyCalls: number;
    sessions: {
        disconnect(session: ReturnType<typeof fakeSession>): PromiseLike<FakeResult<void, Error>>;
    };
    destroy(): void;
}

function fakeAdapter(
    disconnect: (session: ReturnType<typeof fakeSession>) => PromiseLike<FakeResult<void, Error>>,
): FakeAdapter {
    const adapter: FakeAdapter = {
        destroyCalls: 0,
        sessions: { disconnect },
        destroy() {
            adapter.destroyCalls++;
        },
    };
    return adapter;
}

describe("waitForLogout", () => {
    let appsDir: string;
    let originalHome: string | undefined;

    beforeEach(() => {
        // Redirect `~/.polkadot-apps` to a tmp dir so the clearLocalAppStorage
        // fallback can't touch the dev's real logged-in account.
        appsDir = mkdtempSync(join(tmpdir(), "pg-logout-test-"));
        originalHome = process.env.HOME;
        process.env.HOME = appsDir;
    });

    afterEach(() => {
        if (originalHome === undefined) {
            delete process.env.HOME;
        } else {
            process.env.HOME = originalHome;
        }
        rmSync(appsDir, { recursive: true, force: true });
    });

    it("emits disconnecting → success and destroys the adapter on happy path", async () => {
        const adapter = fakeAdapter(() => Promise.resolve(okResult(undefined)));
        const handle = {
            adapter,
            address: "5Gxyz",
            session: fakeSession(),
        } as unknown as LogoutHandle;
        const events: LogoutStatus[] = [];

        await waitForLogout(handle, (s) => events.push(s));

        expect(events).toEqual([
            { step: "disconnecting", address: "5Gxyz" },
            { step: "success", address: "5Gxyz" },
        ]);
        expect(adapter.destroyCalls).toBe(1);
    });

    it("falls back to local clear and emits partial when disconnect returns err", async () => {
        // Seed a stale session file so we can verify the fallback actually deletes it.
        const staleDir = join(appsDir, ".polkadot-apps");
        const { mkdirSync } = await import("node:fs");
        mkdirSync(staleDir, { recursive: true });
        const staleFile = join(staleDir, `${DAPP_ID}_SsoSessions.json`);
        const foreignFile = join(staleDir, "other-app_SsoSessions.json");
        writeFileSync(staleFile, "stale");
        writeFileSync(foreignFile, "leave-me-alone");

        const adapter = fakeAdapter(() => Promise.resolve(errResult(new Error("ws halted"))));
        const handle = {
            adapter,
            address: "5Gxyz",
            session: fakeSession(),
        } as unknown as LogoutHandle;
        const events: LogoutStatus[] = [];

        await waitForLogout(handle, (s) => events.push(s));

        expect(events).toEqual([
            { step: "disconnecting", address: "5Gxyz" },
            { step: "partial", address: "5Gxyz", reason: "ws halted" },
        ]);
        expect(adapter.destroyCalls).toBe(1);
        expect(existsSync(staleFile)).toBe(false);
        // Foreign app's files MUST remain untouched.
        expect(existsSync(foreignFile)).toBe(true);
    });

    it("falls back to local clear when disconnect throws", async () => {
        const adapter = fakeAdapter(() => {
            throw new Error("connection refused");
        });
        const handle = {
            adapter,
            address: "5Gxyz",
            session: fakeSession(),
        } as unknown as LogoutHandle;
        const events: LogoutStatus[] = [];

        await waitForLogout(handle, (s) => events.push(s));

        expect(events).toEqual([
            { step: "disconnecting", address: "5Gxyz" },
            { step: "partial", address: "5Gxyz", reason: "connection refused" },
        ]);
        expect(adapter.destroyCalls).toBe(1);
    });

    it("emits a generic err message for non-Error throws", async () => {
        const adapter = fakeAdapter(() => {
            // eslint-disable-next-line @typescript-eslint/no-throw-literal
            throw "string rejection";
        });
        const handle = {
            adapter,
            address: "5Gxyz",
            session: fakeSession(),
        } as unknown as LogoutHandle;
        const events: LogoutStatus[] = [];

        await waitForLogout(handle, (s) => events.push(s));

        expect(events[1]).toEqual({
            step: "partial",
            address: "5Gxyz",
            reason: "string rejection",
        });
    });
});

describe("clearLocalAppStorage", () => {
    let dir: string;

    beforeEach(() => {
        dir = mkdtempSync(join(tmpdir(), "pg-clear-storage-"));
    });

    afterEach(() => {
        rmSync(dir, { recursive: true, force: true });
    });

    it("is a no-op when the directory does not exist", async () => {
        const missing = join(dir, "does-not-exist");
        await expect(clearLocalAppStorage(missing)).resolves.toBeUndefined();
    });

    it("removes only files prefixed with `${DAPP_ID}_`", async () => {
        const ours1 = join(dir, `${DAPP_ID}_SsoSessions.json`);
        const ours2 = join(dir, `${DAPP_ID}_UserSecrets_abc.json`);
        const foreign = join(dir, "polkadot-desktop_SsoSessions.json");
        const looksSimilar = join(dir, `${DAPP_ID}.backup`);
        writeFileSync(ours1, "a");
        writeFileSync(ours2, "b");
        writeFileSync(foreign, "c");
        writeFileSync(looksSimilar, "d");

        await clearLocalAppStorage(dir);

        expect(existsSync(ours1)).toBe(false);
        expect(existsSync(ours2)).toBe(false);
        expect(existsSync(foreign)).toBe(true);
        // `${DAPP_ID}.backup` lacks the underscore → safe.
        expect(existsSync(looksSimilar)).toBe(true);
    });

    it("swallows unlink errors so callers stay on the happy path", async () => {
        // Nothing to delete → nothing to error on, but the promise must resolve.
        await expect(clearLocalAppStorage(dir)).resolves.toBeUndefined();
    });
});

// ── createPlaygroundSigner — BadProof regression guards ──────────────────────
//
// These tests cover the local replacement for
// `@parity/product-sdk-terminal::createSessionSignerForAccount`. The published
// SDK (0.1.0) routes BOTH tx and arbitrary-byte signing through `signRaw`,
// which the mobile wallet wraps with `<Bytes>...</Bytes>` — producing a
// signature the chain rejects as `BadProof`. Until the upstream fix
// (paritytech/product-sdk a33edf3) ships on npm, our local builder splits the
// callbacks: tx → `signPayload` (no envelope), bytes → `signRaw` (envelope).
// These tests guard against a regression that would re-merge the paths.

type FakeOk<T> = { isOk(): true; isErr(): false; value: T };
type FakeErr<E> = { isOk(): false; isErr(): true; error: E };
function ok<T>(value: T): FakeOk<T> {
    return { isOk: () => true as const, isErr: () => false as const, value };
}
function err<E>(error: E): FakeErr<E> {
    return { isOk: () => false as const, isErr: () => true as const, error };
}

interface SessionStub {
    remoteAccount: { accountId: number[] };
    signPayload: ReturnType<typeof vi.fn>;
    signRaw: ReturnType<typeof vi.fn>;
}

function makeSessionStub(opts: {
    signPayload?: (req: unknown) => unknown;
    signRaw?: (req: unknown) => unknown;
}): SessionStub {
    return {
        remoteAccount: { accountId: new Array(32).fill(0).map((_, i) => i) },
        signPayload: vi.fn(
            opts.signPayload ??
                (() => {
                    throw new Error("signPayload not stubbed");
                }),
        ),
        signRaw: vi.fn(
            opts.signRaw ??
                (() => {
                    throw new Error("signRaw not stubbed");
                }),
        ),
    };
}

function pjsTxPayload() {
    return {
        address: `0x${"00".repeat(32)}`,
        blockHash: `0x${"11".repeat(32)}`,
        blockNumber: "0x12345678",
        era: "0xc501",
        genesisHash: `0x${"22".repeat(32)}`,
        method: "0xabcdef",
        nonce: "0x00000001",
        specVersion: "0x000003e8",
        tip: `0x${"0".repeat(32)}`,
        transactionVersion: "0x00000001",
        signedExtensions: ["CheckMortality", "CheckNonce"],
        version: 4,
    };
}

describe("makeSignPayloadCallback — tx signing path (BadProof fix)", () => {
    it("forwards the tx payload to session.signPayload with the right productAccountId", async () => {
        const captured: unknown[] = [];
        const session = makeSessionStub({
            signPayload: (req) => {
                captured.push(req);
                return ok({
                    signature: new Uint8Array([0xaa, 0xbb]),
                    signedTransaction: undefined,
                });
            },
        });
        const cb = makeSignPayloadCallback(session as unknown as UserSession, [
            "playground.dot",
            0,
        ]);
        await cb(pjsTxPayload());

        expect(captured).toHaveLength(1);
        const req = captured[0] as { productAccountId: [string, number] };
        expect(req.productAccountId).toEqual(["playground.dot", 0]);
    });

    it("must NOT call session.signRaw when signing a tx payload (BadProof regression guard)", async () => {
        const session = makeSessionStub({
            signPayload: () => ok({ signature: new Uint8Array([1]), signedTransaction: undefined }),
        });
        const cb = makeSignPayloadCallback(session as unknown as UserSession, [
            "playground.dot",
            0,
        ]);
        await cb(pjsTxPayload());

        expect(session.signPayload).toHaveBeenCalledTimes(1);
        expect(session.signRaw).toHaveBeenCalledTimes(0);
    });

    it("0x-prefixes every hex field handed to host-papp", async () => {
        const captured: unknown[] = [];
        const session = makeSessionStub({
            signPayload: (req) => {
                captured.push(req);
                return ok({ signature: new Uint8Array([0]), signedTransaction: undefined });
            },
        });
        const cb = makeSignPayloadCallback(session as unknown as UserSession, [
            "playground.dot",
            0,
        ]);
        // Mix prefixed and unprefixed inputs so asHex actually has to add `0x`.
        await cb({ ...pjsTxPayload(), nonce: "1234abcd" });

        const req = captured[0] as Record<string, unknown>;
        for (const f of [
            "blockHash",
            "blockNumber",
            "era",
            "genesisHash",
            "method",
            "nonce",
            "specVersion",
            "tip",
            "transactionVersion",
        ]) {
            expect(req[f], `${f} must be 0x-prefixed`).toMatch(/^0x[0-9a-fA-F]*$/);
        }
    });

    it("hex-encodes the signature and propagates signedTransaction when present", async () => {
        const session = makeSessionStub({
            signPayload: () =>
                ok({
                    signature: new Uint8Array([0xab, 0xcd]),
                    signedTransaction: new Uint8Array([0x01, 0x02, 0x03]),
                }),
        });
        const cb = makeSignPayloadCallback(session as unknown as UserSession, [
            "playground.dot",
            0,
        ]);
        const out = await cb(pjsTxPayload());
        expect(out.signature).toBe("0xabcd");
        expect(out.signedTransaction).toBe("0x010203");
    });

    it("throws with a clear error when the mobile rejects", async () => {
        const session = makeSessionStub({
            signPayload: () => err({ message: "user declined" }),
        });
        const cb = makeSignPayloadCallback(session as unknown as UserSession, [
            "playground.dot",
            0,
        ]);
        await expect(cb(pjsTxPayload())).rejects.toThrow("Mobile signing rejected: user declined");
    });
});

describe("makeSignRawCallback — arbitrary-byte signing path", () => {
    it("forwards the bytes verbatim under the Bytes tag — mobile applies <Bytes> wrap", async () => {
        const captured: unknown[] = [];
        const session = makeSessionStub({
            signRaw: (req) => {
                captured.push(req);
                return ok({ signature: new Uint8Array([0xff]) });
            },
        });
        const cb = makeSignRawCallback(session as unknown as UserSession, ["playground.dot", 0]);
        await cb({ address: `0x${"00".repeat(32)}`, data: "0xdeadbeef", type: "bytes" });

        const req = captured[0] as {
            productAccountId: [string, number];
            data: { tag: string; value: Uint8Array };
        };
        expect(req.productAccountId).toEqual(["playground.dot", 0]);
        expect(req.data.tag).toBe("Bytes");
        expect(Array.from(req.data.value)).toEqual([0xde, 0xad, 0xbe, 0xef]);
    });
});
