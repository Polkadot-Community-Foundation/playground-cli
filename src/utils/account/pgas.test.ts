// Copyright (C) Parity Technologies (UK) Ltd.
// SPDX-License-Identifier: Apache-2.0

import { describe, it, expect } from "vitest";
import { formatTokenAmount } from "./pgas.js";

describe("formatTokenAmount", () => {
    it("formats whole units with the symbol", () => {
        expect(formatTokenAmount(50_000_000_000n, 9, "PGAS")).toBe("50 PGAS");
    });

    it("trims trailing fractional zeros", () => {
        expect(formatTokenAmount(1_500_000_000n, 9, "PGAS")).toBe("1.5 PGAS");
    });

    it("renders zero cleanly", () => {
        expect(formatTokenAmount(0n, 9, "PGAS")).toBe("0 PGAS");
    });

    it("handles 0 decimals (integer asset)", () => {
        expect(formatTokenAmount(42n, 0, "PGAS")).toBe("42 PGAS");
    });

    it("keeps significant fractional digits", () => {
        expect(formatTokenAmount(1_234_500_000n, 9, "PGAS")).toBe("1.2345 PGAS");
    });

    it("omits the suffix when symbol is empty", () => {
        expect(formatTokenAmount(5_000_000_000n, 9, "")).toBe("5");
    });

    it("groups large integer (0-decimal) amounts with thousands separators", () => {
        expect(formatTokenAmount(354_793_859_857n, 0, "")).toBe("354,793,859,857");
    });

    it("groups the integer part of fractional amounts", () => {
        expect(formatTokenAmount(1_234_567_500_000_000n, 9, "PGAS")).toBe("1,234,567.5 PGAS");
    });

    // PGAS is 1:1 with PAS (PAS_DECIMALS = 10) — the scale `playground status`
    // actually uses. 354_793_859_857 planck is the real on-chain balance observed
    // on paseo-next-v2, which renders ~35.4793 PGAS at 10 decimals (capped 4 dp).
    it("formats the real PGAS balance at the 10-decimal PAS scale, capped at 4 dp", () => {
        expect(formatTokenAmount(354_793_859_857n, 10, "PGAS")).toBe("35.4793 PGAS");
    });

    it("caps the fraction at 4 digits (truncates, not rounds)", () => {
        expect(formatTokenAmount(199_999_000_000n, 10, "PGAS")).toBe("19.9999 PGAS");
    });

    it("drops the fraction entirely when it rounds below the 4-digit window", () => {
        // 1.00000001 at 10 decimals -> first 4 fractional digits are all zero
        expect(formatTokenAmount(10_000_000_100n, 10, "PGAS")).toBe("1 PGAS");
    });
});
