/**
 * E2E tests for `dot mod`.
 *
 * `dot mod <domain>` is fully non-interactive when a domain is supplied:
 * the AppBrowser picker is skipped, and SetupScreen runs StepRunner with
 * no `useInput`. So passing `--suri //Alice` is enough — there's no
 * `--yes` to skip a prompt because there's no prompt left.
 *
 * Requires chain connectivity (registry) and GitHub access (codeload
 * tarball download) for the happy path.
 */

import { describe, test, expect, afterEach } from "vitest";
import { existsSync, mkdtempSync, readdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { dot } from "./helpers/dot.js";
import { ALICE } from "./fixtures/accounts.js";
import { TEST_DOMAIN } from "./fixtures/templates.js";

const tempDirs: string[] = [];

function makeTempDir(prefix: string): string {
	const dir = mkdtempSync(join(tmpdir(), prefix));
	tempDirs.push(dir);
	return dir;
}

afterEach(() => {
	for (const dir of tempDirs) {
		try {
			if (existsSync(dir)) rmSync(dir, { recursive: true, force: true });
		} catch { /* best-effort cleanup */ }
	}
	tempDirs.length = 0;
});

describe("dot mod", () => {
	test.skipIf(!TEST_DOMAIN)(
		"clones the registered template into a fresh directory",
		{ timeout: 180_000 },
		async () => {
			const cwd = makeTempDir("dot-e2e-mod-cwd-");
			const result = await dot(["mod", TEST_DOMAIN, "--suri", ALICE.suri], {
				cwd,
				timeout: 180_000,
			});

			expect(result.exitCode).toBe(0);
			// defaultRepoName slugifies the domain and appends a 6-hex suffix.
			const slug = TEST_DOMAIN.replace(/\.dot$/, "")
				.toLowerCase()
				.replace(/[^a-z0-9]+/g, "-");
			const created = readdirSync(cwd).filter(
				(name) => name.startsWith(`${slug}-`) && /-[0-9a-f]{6}$/.test(name),
			);
			expect(created).toHaveLength(1);
			expect(existsSync(join(cwd, created[0]!, "package.json"))).toBe(true);
		},
	);

	test("reports a registry-miss for an unknown domain", { timeout: 120_000 }, async () => {
		const cwd = makeTempDir("dot-e2e-mod-unknown-");
		const domain = "nonexistent-domain-xyz-12345.dot";
		const result = await dot(
			["mod", domain, "--suri", ALICE.suri],
			{ cwd, timeout: 120_000 },
		);
		const output = result.stdout + result.stderr;
		expect(
			result.exitCode,
			`expected non-zero exit for unknown domain\n${output}`,
		).not.toBe(0);
		// Exact wording from src/commands/mod/SetupScreen.tsx:
		//   throw new Error(`App "${domain}" not found in registry`);
		// Matching both fragments rules out an unrelated "not found" landing
		// in output (e.g., a transient 404 from an IPFS gateway probe).
		expect(output).toContain(domain);
		expect(output).toContain("not found in registry");
	});

	test("exits non-zero with signer suggestion when no signer available", async () => {
		const tempHome = makeTempDir("dot-e2e-mod-home-");
		const cwd = makeTempDir("dot-e2e-mod-cwd-");
		const result = await dot(["mod", "some-app.dot"], { home: tempHome, cwd });
		expect(result.exitCode).not.toBe(0);
		const output = result.stdout + result.stderr;
		// Exact wording from src/utils/signer.ts SignerNotAvailableError:
		//   `No signer available. Run "dot init" to log in, or pass --suri //Alice for dev.`
		// The previous regex /signer|init|log.?in/i matched any of those words
		// anywhere — including help text — so it passed even on early crashes
		// that never reached the signer-resolution path.
		expect(output).toContain("No signer available");
		expect(output).toContain("dot init");
	});
});
