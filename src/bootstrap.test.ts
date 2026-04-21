import { readFileSync } from "node:fs";
import { beforeEach, describe, expect, it, vi } from "vitest";

describe("bootstrap", () => {
    beforeEach(() => {
        delete process.env.BULLETIN_DEPLOY_TELEMETRY;
        delete process.env.BULLETIN_DEPLOY_MEM_REPORT;
        vi.resetModules();
    });

    it("forces BULLETIN_DEPLOY_TELEMETRY=0 when the user has not set it", async () => {
        await import("./bootstrap.js");
        expect(process.env.BULLETIN_DEPLOY_TELEMETRY).toBe("0");
    });

    it("forces BULLETIN_DEPLOY_MEM_REPORT=0 when the user has not set it", async () => {
        await import("./bootstrap.js");
        expect(process.env.BULLETIN_DEPLOY_MEM_REPORT).toBe("0");
    });

    it("preserves an explicit BULLETIN_DEPLOY_TELEMETRY opt-in", async () => {
        process.env.BULLETIN_DEPLOY_TELEMETRY = "1";
        await import("./bootstrap.js");
        expect(process.env.BULLETIN_DEPLOY_TELEMETRY).toBe("1");
    });

    it("preserves an explicit BULLETIN_DEPLOY_MEM_REPORT opt-in", async () => {
        process.env.BULLETIN_DEPLOY_MEM_REPORT = "1";
        await import("./bootstrap.js");
        expect(process.env.BULLETIN_DEPLOY_MEM_REPORT).toBe("1");
    });

    // Load-bearing structural invariant: if bootstrap stops being the first
    // import of `src/index.ts`, the bulletin-deploy import chain will evaluate
    // its `DISABLED` gate before our env vars are set — which is the exact bug
    // this module exists to prevent. A Biome reorder / careless rebase could
    // silently break the fix; this test nails the ordering down.
    it("is the first import in src/index.ts", () => {
        const src = readFileSync("src/index.ts", "utf-8");
        const firstImport = src.match(/^import\s+(?:[^;]+\s+from\s+)?["']([^"']+)["'];?$/m);
        expect(firstImport?.[1]).toBe("./bootstrap.js");
    });
});
