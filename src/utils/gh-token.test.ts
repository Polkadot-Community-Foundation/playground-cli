import { describe, it, expect, beforeEach } from "vitest";
import { getGhToken, ghAuthHeaders, resetGhTokenCacheForTests } from "./gh-token.js";

describe("getGhToken / ghAuthHeaders", () => {
    beforeEach(() => {
        resetGhTokenCacheForTests();
    });

    it("returns either a non-empty string or null without throwing", async () => {
        const token = await getGhToken();
        if (token !== null) {
            expect(typeof token).toBe("string");
            expect(token.length).toBeGreaterThan(0);
        }
    });

    it("caches the result across calls", async () => {
        const a = await getGhToken();
        const b = await getGhToken();
        expect(a).toBe(b);
    });

    it("returns an Authorization header when a token is available, else an empty object", async () => {
        const token = await getGhToken();
        const headers = await ghAuthHeaders();
        if (token) {
            expect(headers).toEqual({ Authorization: `Bearer ${token}` });
        } else {
            expect(headers).toEqual({});
        }
    });
});
