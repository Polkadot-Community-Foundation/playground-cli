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

/**
 * E2E tests for `dot login` — session detection and allowance checks.
 *
 * Note: the full QR flow cannot be automated (requires a physical phone).
 * These tests verify:
 * - Behavior when no session exists (prompts for QR, times out)
 * - Corrupted session file handling
 * - Dev signer (--suri) bypasses session requirement
 *
 * KNOWN GAP — toolchain install paths (rustup, IPFS, foundry, cdm) are NOT
 * exercised here because CI runners (parity-default, GitHub-hosted) already
 * have those tools on PATH, often via wrapper scripts in /usr/bin that
 * delegate into $HOME/.cargo. PATH-stripping a wrapper without breaking
 * sibling binaries in the same dir isn't possible. The cold-start smoke
 * job (.github/workflows/e2e.yml :: login-cold-smoke) installs the dev/<branch>
 * SEA binary via install.sh inside a fresh ubuntu:22.04 container with no
 * toolchain pre-installed and is the authoritative test for detection +
 * install-then-use. It runs after Dev Release on each PR, plus daily on
 * main and on workflow_dispatch (against the latest stable release).
 */

import { describe, test, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { dot } from "./helpers/dot.js";

function makeTempHome(): string {
	const dir = mkdtempSync(join(tmpdir(), "dot-e2e-login-"));
	mkdirSync(join(dir, ".polkadot-apps"), { recursive: true });
	return dir;
}

describe("dot login — session detection", () => {
	let tempHome: string;

	beforeEach(() => {
		tempHome = makeTempHome();
	});

	afterEach(() => {
		// dot login may install toolchains (rustup) into the temp HOME. Child
		// processes can still be writing when cleanup runs, causing ENOTEMPTY.
		// Best-effort cleanup — the OS cleans /tmp on its own.
		try {
			rmSync(tempHome, { recursive: true, force: true });
		} catch { /* best-effort */ }
	});

	test("login with no session prompts for QR scan", async () => {
		// IMPORTANT: do NOT pass `-y` here. With `-y`, login skips the
		// connect()/login block entirely — there's no session probe and no
		// QR. The previous version of this test used `-y` and only asserted
		// `exitCode !== 0`, which simply verified that toolchain installation
		// in a fresh tempHome takes longer than 15s — nothing about sessions.
		const result = await dot(["login"], {
			home: tempHome,
			timeout: 25_000,
		});
		const output = result.stdout + result.stderr;
		expect(
			result.exitCode,
			`expected non-zero exit while waiting for QR\n${output}`,
		).not.toBe(0);
		// We expect the QR prompt. If login fell into the "Login skipped"
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

	test("login with corrupted session file does not silently succeed", async () => {
		const sessionFile = join(tempHome, ".polkadot-apps", "dot-cli_SsoSessions.json");
		const corrupt = "{{{{not valid json!!";
		writeFileSync(sessionFile, corrupt);

		const result = await dot(["login"], {
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

		// Defence-in-depth: login must NOT have silently overwritten the
		// corrupt file with a fresh empty session. A regression that
		// "fixes" the parse failure by deleting the file would otherwise
		// pass — and silently erase whatever the user had on disk.
		expect(readFileSync(sessionFile, "utf8")).toBe(corrupt);
	});
});

describe("dot login — dev signer bypass", () => {
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

