#!/usr/bin/env bun

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
 * Register the fixed E2E playground-registry entries against the active chain.
 *
 * Uses the same publish path as `dot deploy --playground`: metadata is stored
 * through `publishToPlayground()`, then the registry entry is written by the
 * fixture signer. Re-running is idempotent for domains already owned by that
 * signer.
 */

import { parseArgs } from "node:util";
import { destroyConnection } from "../src/utils/connection.js";
import { publishToPlayground, normalizeDomain } from "../src/utils/deploy/playground.js";
import { resolveSigner } from "../src/utils/signer.js";
import { SIGNER, E2E_DOMAINS } from "../e2e/cli/fixtures/accounts.js";
import { destroyTestClient } from "../e2e/cli/helpers/chain.js";
import { fundAccountIfLow } from "../e2e/cli/setup/fund.js";

const DEFAULT_TEMPLATE_DOMAIN = "dot-cli-mod-fixture.dot";
const DEFAULT_TEMPLATE_REPO = "https://github.com/paritytech/Rock-Paper-Scissors";

interface Fixture {
	domain: string;
	repositoryUrl: string | null;
}

const FIXTURES: readonly Fixture[] = [
	{
		domain: process.env.TEST_TEMPLATE_DOMAIN ?? DEFAULT_TEMPLATE_DOMAIN,
		repositoryUrl: process.env.TEST_TEMPLATE_REPO ?? DEFAULT_TEMPLATE_REPO,
	},
	...[
		E2E_DOMAINS.preflight,
		E2E_DOMAINS.storage,
		E2E_DOMAINS.redeploy,
		E2E_DOMAINS.collision,
		E2E_DOMAINS.foundry,
		E2E_DOMAINS.cdm,
		E2E_DOMAINS.hardhat,
		E2E_DOMAINS.multi,
	].map((domain) => ({ domain, repositoryUrl: null })),
];

function usage(): string {
	return [
		"Usage: bun tools/register-e2e-fixtures.ts [--domain <domain>] [--suri <suri>]",
		"",
		"Fixtures:",
		...FIXTURES.map((fixture) => `  ${normalizeDomain(fixture.domain).fullDomain}`),
	].join("\n");
}

function selectedFixtures(domain?: string): readonly Fixture[] {
	if (!domain) return FIXTURES;

	const requested = normalizeDomain(domain).fullDomain.toLowerCase();
	return FIXTURES.filter(
		(fixture) => normalizeDomain(fixture.domain).fullDomain.toLowerCase() === requested,
	);
}

function describeFixture(fixture: Fixture): string {
	const fullDomain = normalizeDomain(fixture.domain).fullDomain;
	return `${fullDomain}  repo=${fixture.repositoryUrl ?? "(none)"}`;
}

function logPlan(fixtures: readonly Fixture[]): void {
	console.log(`registering ${fixtures.length} fixture(s) as private Playground apps:`);
	for (const fixture of fixtures) {
		console.log(`  - ${describeFixture(fixture)}`);
	}
	console.log();
}

async function registerFixture(
	fixture: Fixture,
	signer: Awaited<ReturnType<typeof resolveSigner>>,
	index: number,
	total: number,
): Promise<void> {
	const fullDomain = normalizeDomain(fixture.domain).fullDomain;
	const start = Date.now();
	console.log(`[${index}/${total}] ${fullDomain}`);
	console.log(`  repository  ${fixture.repositoryUrl ?? "(none)"}`);
	console.log("  visibility  private");

	const result = await publishToPlayground({
		domain: fixture.domain,
		publishSigner: signer,
		repositoryUrl: fixture.repositoryUrl,
		isPrivate: true,
		onLogEvent: (event) => {
			if (event.kind === "info") console.log(`  ${event.message}`);
		},
	});

	const elapsed = ((Date.now() - start) / 1000).toFixed(1);
	console.log(`  published   ${result.metadataCid} (${elapsed}s)`);
	console.log();
}

async function main(): Promise<number> {
	const { values } = parseArgs({
		options: {
			domain: { type: "string" },
			help: { type: "boolean", short: "h" },
			suri: { type: "string" },
		},
	});

	if (values.help) {
		console.log(usage());
		return 0;
	}

	let fixtures: readonly Fixture[];
	try {
		fixtures = selectedFixtures(values.domain);
	} catch (err) {
		console.error(err instanceof Error ? err.message : String(err));
		console.error(usage());
		return 2;
	}

	if (fixtures.length === 0) {
		console.error(`No fixture matches "${values.domain}".`);
		console.error(usage());
		return 2;
	}

	const signer = await resolveSigner({ suri: values.suri ?? SIGNER.suri });
	try {
		logPlan(fixtures);
		console.log(`signer ${signer.address} (${signer.source})`);
		await fundAccountIfLow({ name: "fixture signer", address: signer.address });
		console.log();

		for (const [index, fixture] of fixtures.entries()) {
			await registerFixture(fixture, signer, index + 1, fixtures.length);
		}
		console.log(`registered ${fixtures.length} fixture(s)`);
		return 0;
	} finally {
		signer.destroy();
		destroyTestClient();
		destroyConnection();
	}
}

main()
	.then((code) => process.exit(code))
	.catch((err) => {
		console.error(err instanceof Error ? (err.stack ?? err.message) : String(err));
		process.exit(2);
	});
