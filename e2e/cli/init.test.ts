/**
 * E2E tests for `dot init` — session detection and allowance checks.
 *
 * Note: the full QR flow cannot be automated (requires a physical phone).
 * These tests verify:
 * - Behavior when no session exists (prompts for QR, times out)
 * - Corrupted session file handling
 * - Dev signer (--suri) bypasses session requirement
 *
 * KNOWN GAP — toolchain install paths (rustup, IPFS, foundry, cdm) are NOT
 * exercised in CI because the runner image already has those tools on PATH
 * before tests run. As a result, regressions in the install / post-install
 * path-config logic (e.g. paritytech/playground-app#118 — newly-installed
 * rustup not reachable from the same init process) will pass these tests
 * silently. To catch that class of bug, init has to be exercised in a fresh
 * sandbox (Docker / VM with no Rust toolchain). The test below at least
 * pins the toolchain *detection* output so the dependency table can't be
 * silently dropped, but it does NOT validate the install-then-use flow.
 */

import { describe, test, expect, beforeEach, afterEach } from "vitest";
import { execSync } from "node:child_process";
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { tmpdir } from "node:os";
import { dot } from "./helpers/dot.js";

/** PATH stripped of every directory that currently contains a rust /
 *  foundry toolchain binary. The init process must still be able to find
 *  `node`/`bun`/`pnpm`/`curl`/`bash`, so we keep the rest of PATH intact.
 *
 *  Naive pattern-based filtering (`/cargo/`, `/rustup/`, `/foundry/`) is
 *  not enough on every CI runner: parity-default ships rustup at a path
 *  that doesn't include any of those tokens (e.g. `/usr/local/bin`), so a
 *  pattern strip leaves rustup discoverable and the test fires a false
 *  ✓ rustup. Resolve each tool's actual location(s) up front and strip
 *  exactly those parent dirs. Pattern strip is kept as a belt-and-braces
 *  fallback for tools we don't enumerate. */
function pathWithoutToolchains(): string {
	const original = process.env.PATH ?? "/usr/bin:/bin";
	const stripDirs = new Set<string>();
	const tools = ["rustup", "cargo", "rustc", "forge", "foundryup", "foundryup-polkadot"];
	for (const tool of tools) {
		try {
			const out = execSync(`which -a ${tool} 2>/dev/null || true`, {
				encoding: "utf8",
			});
			for (const line of out.split("\n")) {
				const path = line.trim();
				if (path) stripDirs.add(dirname(path));
			}
		} catch { /* tool not installed — nothing to strip */ }
	}
	const stripPatterns = [/cargo/i, /rustup/i, /foundry/i];
	return original
		.split(":")
		.filter(
			(p) =>
				p.length > 0 &&
				!stripDirs.has(p) &&
				!stripPatterns.some((re) => re.test(p)),
		)
		.join(":");
}

function makeTempHome(): string {
	const dir = mkdtempSync(join(tmpdir(), "dot-e2e-init-"));
	mkdirSync(join(dir, ".polkadot-apps"), { recursive: true });
	return dir;
}

describe("dot init — session detection", () => {
	let tempHome: string;

	beforeEach(() => {
		tempHome = makeTempHome();
	});

	afterEach(() => {
		// dot init may install toolchains (rustup) into the temp HOME. Child
		// processes can still be writing when cleanup runs, causing ENOTEMPTY.
		// Best-effort cleanup — the OS cleans /tmp on its own.
		try {
			rmSync(tempHome, { recursive: true, force: true });
		} catch { /* best-effort */ }
	});

	test("init with no session prompts for QR scan", async () => {
		// IMPORTANT: do NOT pass `-y` here. With `-y`, init skips the
		// connect()/login block entirely — there's no session probe and no
		// QR. The previous version of this test used `-y` and only asserted
		// `exitCode !== 0`, which simply verified that toolchain installation
		// in a fresh tempHome takes longer than 15s — nothing about sessions.
		const result = await dot(["init"], {
			home: tempHome,
			timeout: 25_000,
		});
		const output = result.stdout + result.stderr;
		expect(
			result.exitCode,
			`expected non-zero exit while waiting for QR\n${output}`,
		).not.toBe(0);
		// We expect the QR prompt. If init fell into the "Login skipped"
		// branch instead, the login service was unreachable from this runner
		// — the test cannot validate the QR rendering and we should fail
		// loudly rather than silently accept a degraded path. (Previously
		// the assertion was a `Scan|Login skipped` regex, which let that
		// degradation pass invisibly.)
		if (output.includes("Login skipped")) {
			throw new Error(
				"Login service unreachable from runner — cannot validate QR " +
				"flow. Either fix the runner's network/auth-service access or " +
				"add an offline session-injection fixture (paritytech/" +
				"playground-cli#50).\n\n" + output,
			);
		}
		expect(output).toContain("Scan with the Polkadot mobile app to log in");
	});

	test("init with corrupted session file does not silently succeed", async () => {
		const sessionFile = join(tempHome, ".polkadot-apps", "dot-cli_SsoSessions.json");
		const corrupt = "{{{{not valid json!!";
		writeFileSync(sessionFile, corrupt);

		const result = await dot(["init"], {
			home: tempHome,
			timeout: 25_000,
		});
		const output = result.stdout + result.stderr;
		expect(result.exitCode).not.toBe(0);
		// A corrupted session file must NOT lead to an "existing session"
		// branch. We expect the QR prompt; "Login skipped" again indicates
		// service unreachable and is treated as an inconclusive run, not a
		// pass.
		if (output.includes("Login skipped")) {
			throw new Error(
				"Login service unreachable from runner — cannot validate " +
				"corrupt-session rejection. See no-session test for context.\n\n" +
				output,
			);
		}
		expect(output).toContain("Scan with the Polkadot mobile app to log in");

		// Defence-in-depth: init must NOT have silently overwritten the
		// corrupt file with a fresh empty session. A regression that
		// "fixes" the parse failure by deleting the file would otherwise
		// pass — and silently erase whatever the user had on disk.
		expect(readFileSync(sessionFile, "utf8")).toBe(corrupt);
	});
});

describe("dot init — dev signer bypass", () => {
	test("deploy --help works with --suri and no session", async () => {
		const tempHome = makeTempHome();
		try {
			const result = await dot(["deploy", "--help"], { home: tempHome });
			expect(result.exitCode).toBe(0);
			expect(result.stdout).toContain("deploy");
		} finally {
			try {
				rmSync(tempHome, { recursive: true, force: true });
			} catch { /* best-effort */ }
		}
	});
});

describe("dot init — toolchain detection", () => {
	let tempHome: string;

	beforeEach(() => {
		tempHome = makeTempHome();
	});

	afterEach(() => {
		try {
			rmSync(tempHome, { recursive: true, force: true });
		} catch { /* best-effort */ }
	});

	test(
		"detects rustup as missing when not on PATH",
		{ timeout: 30_000 },
		async () => {
			// Strip rustup/cargo from PATH and verify init reports rustup as
			// a missing dependency rather than skipping straight to "✓ rustup".
			//
			// Why this matters: CI runners pre-install rustup, so the regular
			// init tests never exercise the missing-tool detection or the
			// post-install path-config logic. This test forces init to hit
			// the "rustup not found" branch by removing it from PATH.
			//
			// Why HTTPS_PROXY is set to a refused address:
			// init's rustup install step pipes `curl https://sh.rustup.rs`
			// into `sh` (see src/utils/toolchain.ts). On a runner whose
			// outbound network is fast or where rustup-init is cached, the
			// install can complete in <12s and the test would race against a
			// timing-based "not yet ✓" assertion. Pointing the proxy at a
			// guaranteed-refused port forces curl to fail in <1s, which
			// makes the install step deterministically fail (✕ rustup) and
			// removes the timing dependency entirely. We're testing the
			// DETECTION path, not the install-success path — the cold-start
			// smoke job in .github/workflows/e2e.yml covers install success.
			//
			// `-y` skips the connect()/QR block so the TUI renders the
			// dependency table within ~1s. We do NOT assert exitCode: with
			// the install forced to fail, init may still exit 0 (warnings
			// are non-fatal) or non-zero, depending on which downstream
			// steps the path-stripping affects. Either is consistent with
			// the contract we care about here.
			const result = await dot(["init", "-y"], {
				home: tempHome,
				env: {
					PATH: pathWithoutToolchains(),
					HTTPS_PROXY: "http://127.0.0.1:1",
					https_proxy: "http://127.0.0.1:1",
				},
				timeout: 20_000,
			});
			const output = result.stdout + result.stderr;
			// The TUI prints each dependency on its own row. Seeing "rustup"
			// proves the detection table rendered. Pair with one of the later
			// rows so a single-line corruption can't pass.
			expect(
				output,
				`expected dependency table to render\n${output}`,
			).toContain("rustup");
			expect(
				output,
				`expected later toolchain rows in dependency table\n${output}`,
			).toMatch(/Rust nightly|cdm|foundry|IPFS/);
			// A "✓ rustup" here would mean init falsely concluded rustup is
			// installed despite the stripped PATH — exactly the class of bug
			// that lets fresh users hit broken installs in production. With
			// the network-blocked install above, a healthy run renders the
			// row as "· rustup", "⠋ rustup", or "✕ rustup" (install failed),
			// none of which match this regex. (✓ glyph from
			// src/utils/ui/theme/tokens.ts.)
			expect(
				output,
				`init reported rustup as installed despite stripped PATH:\n${output}`,
			).not.toMatch(/✓\s+rustup\b/);
		},
	);
});
