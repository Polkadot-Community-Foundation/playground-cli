/**
 * E2E tests for diagnostic/verbose modes.
 *
 * Tests that environment variables like DOT_DEPLOY_VERBOSE and DOT_MEMORY_TRACE
 * produce additional diagnostic output without breaking normal operation.
 */

import { describe, test, expect } from "vitest";
import { resolve } from "node:path";
import { dot } from "./helpers/dot.js";
import { SIGNER, E2E_DOMAINS } from "./fixtures/accounts.js";
import { fixturePath } from "./fixtures/templates.js";

const frontendOnly = fixturePath("frontend-only");

describe("diagnostic mode", () => {
	test("DOT_DEPLOY_VERBOSE=1 does not break deploy preflight", async () => {
		// Use SIGNER (funded by globalSetup) so preflight reaches the
		// availability check; ALICE's balance is too low and the run would
		// abort before producing any verbose-eligible output.
		const result = await dot([
			"deploy",
			"--signer", "dev",
			"--domain", E2E_DOMAINS.preflight,
			"--buildDir", resolve(frontendOnly, "dist"),
			"--no-build",
			"--playground",
			"--suri", SIGNER.suri,
			"--dir", frontendOnly,
		], {
			env: { DOT_DEPLOY_VERBOSE: "1" },
			timeout: 120_000,
		});
		const output = result.stdout + result.stderr;
		// Reaching this banner is the real signal that preflight survived.
		// Earlier this asserted /checking availability|deploy|mainnet/i — the
		// `deploy` alternative matched the command name itself, so the test
		// passed even when nothing of substance ran.
		expect(
			output,
			`expected to reach availability check with verbose on\n${output}`,
		).toContain("Checking availability");
	});

	test("DOT_MEMORY_TRACE=1 does not prevent normal operation", async () => {
		const result = await dot(["--help"], {
			env: { DOT_MEMORY_TRACE: "1" },
			timeout: 15_000,
		});
		expect(result.exitCode).toBe(0);
		// `deploy` appears in the subcommand list — that's the meaningful
		// signal here. Pair with another known help string to make sure
		// we got real `--help` output, not a stray match.
		expect(result.stdout).toContain("deploy");
		expect(result.stdout).toContain("Usage:");
	});
});
