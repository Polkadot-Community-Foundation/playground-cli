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

// Mock the gate decision + the Ink render so the test exercises only the
// mapping contract enforceIdentityGate owns. withSpan is collapsed to a
// pass-through so the span wrapper doesn't pull in Sentry.
const { checkIdentityGateMock, resolveActingH160Mock, renderNoticeMock } = vi.hoisted(() => ({
    checkIdentityGateMock: vi.fn(),
    resolveActingH160Mock: vi.fn().mockResolvedValue(undefined),
    renderNoticeMock: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../../utils/identity/identityGate.js", () => ({
    checkIdentityGate: checkIdentityGateMock,
    resolveActingH160: resolveActingH160Mock,
}));

vi.mock("./IdentityGateNotice.js", () => ({
    renderIdentityGateNotice: renderNoticeMock,
}));

vi.mock("../../telemetry.js", () => ({
    withSpan: (_op: string, _name: string, fn: () => unknown) => fn(),
}));

import { enforceIdentityGate } from "./gateOrNotice.js";

const RAW = {} as any;
const H160 = "0xbeefbeefbeefbeefbeefbeefbeefbeefbeefbeef" as `0x${string}`;

beforeEach(() => {
    vi.clearAllMocks();
    renderNoticeMock.mockResolvedValue(undefined);
    resolveActingH160Mock.mockResolvedValue(undefined);
});

describe("enforceIdentityGate", () => {
    it("does not block a revealed builder and prints nothing", async () => {
        checkIdentityGateMock.mockResolvedValue({ status: "revealed", productH160: H160 });

        const blocked = await enforceIdentityGate(RAW);

        expect(blocked).toBe(false);
        expect(renderNoticeMock).not.toHaveBeenCalled();
    });

    it.each(["not-logged-in", "anonymous", "unverifiable"] as const)(
        "blocks and renders the %s notice",
        async (status) => {
            checkIdentityGateMock.mockResolvedValue(
                status === "unverifiable" ? { status, detail: "x" } : { status, productH160: H160 },
            );

            const blocked = await enforceIdentityGate(RAW);

            expect(blocked).toBe(true);
            expect(renderNoticeMock).toHaveBeenCalledTimes(1);
            expect(renderNoticeMock).toHaveBeenCalledWith(status);
        },
    );

    it.each(["1", "true", "yes"])(
        "PCF: PLAYGROUND_SKIP_IDENTITY_GATE=%s opts the operator out without reading the chain",
        async (val) => {
            vi.stubEnv("PLAYGROUND_SKIP_IDENTITY_GATE", val);

            const blocked = await enforceIdentityGate(RAW);

            expect(blocked).toBe(false);
            expect(checkIdentityGateMock).not.toHaveBeenCalled();
            expect(renderNoticeMock).not.toHaveBeenCalled();
            vi.unstubAllEnvs();
        },
    );

    it.each(["0", "false", ""])(
        "PCF: PLAYGROUND_SKIP_IDENTITY_GATE=%s does NOT bypass (gate still enforced)",
        async (val) => {
            vi.stubEnv("PLAYGROUND_SKIP_IDENTITY_GATE", val);
            checkIdentityGateMock.mockResolvedValue({ status: "not-logged-in" });

            const blocked = await enforceIdentityGate(RAW);

            expect(blocked).toBe(true);
            expect(checkIdentityGateMock).toHaveBeenCalledTimes(1);
            vi.unstubAllEnvs();
        },
    );

    /**
     * Callers pass the client and nothing else. There used to be a second
     * parameter for a pre-resolved contract; `mod` passed its registry handle
     * (which has no `isVerified`), the cast hid it from tsc, and every `mod`
     * run reported "couldn't verify your builder status" on a healthy chain.
     * The gate resolves the verifier itself now, so that is unrepresentable —
     * this pins that nothing is forwarded.
     */
    it("passes only the client to the gate — no contract can be injected", async () => {
        checkIdentityGateMock.mockResolvedValue({ status: "revealed", productH160: H160 });

        await enforceIdentityGate(RAW);

        expect(checkIdentityGateMock).toHaveBeenCalledWith(RAW, {});
    });

    it("checks the explicitly chosen signer's account instead of the session", async () => {
        resolveActingH160Mock.mockResolvedValue(H160);
        checkIdentityGateMock.mockResolvedValue({ status: "revealed", productH160: H160 });

        await enforceIdentityGate(RAW, { suri: "//Bob" });

        expect(resolveActingH160Mock).toHaveBeenCalledWith({ suri: "//Bob" });
        expect(checkIdentityGateMock).toHaveBeenCalledWith(RAW, { account: H160 });
    });
});
