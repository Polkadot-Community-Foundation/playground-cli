import { defineConfig } from "vitest/config";

const isCI = process.env.CI === "true";

export default defineConfig({
    test: {
        include: ["e2e/**/*.test.ts"],
        testTimeout: 120_000,
        hookTimeout: 60_000,
        globalSetup: ["e2e/cli/setup/global.ts"],
        fileParallelism: false,
        // Chain client WebSockets may keep the event loop alive after teardown.
        // Force exit after tests complete rather than hanging.
        teardownTimeout: 5_000,
        // Always emit JUnit XML for the report job. Add a human-readable
        // streaming reporter on local runs so developers see live progress;
        // CI runs strip it because the run logs are noisy enough already.
        reporters: isCI ? ["junit"] : ["default", "junit"],
        outputFile: { junit: "e2e-reports/junit.xml" },
    },
});
