import React from "react";
import { render } from "ink";
import { Command } from "commander";
import { getGateway, fetchJson } from "@polkadot-apps/bulletin";
import { resolveSigner } from "../../utils/signer.js";
import { getConnection, destroyConnection } from "../../utils/connection.js";
import { getRegistryContract } from "../../utils/registry.js";
import { AppBrowser, type AppEntry } from "./AppBrowser.js";

interface AppMetadata {
    name?: string;
    description?: string;
    repository?: string;
    branch?: string;
    icon_cid?: string;
    tag?: string;
}

export const modCommand = new Command("mod")
    .description("Clone a playground app template")
    .argument("[domain]", "App domain to clone (interactive picker if omitted)")
    .option("--suri <suri>", "Signer secret URI (e.g. //Alice for dev)")
    .action(async (rawDomain: string | undefined, opts) => {
        const resolved = await resolveSigner({ suri: opts.suri });
        const client = await getConnection();
        const registry = await getRegistryContract(client.raw.assetHub, resolved);

        try {
            if (rawDomain) {
                await directLookup(rawDomain, registry);
            } else {
                await interactiveBrowse(registry);
            }
        } finally {
            resolved.destroy();
            destroyConnection();
        }
    });

async function directLookup(rawDomain: string, registry: any) {
    const domain = rawDomain.endsWith(".dot") ? rawDomain : `${rawDomain}.dot`;
    const gateway = getGateway("paseo");

    console.log(`  Looking up ${domain}...`);
    const metaRes = await registry.getMetadataUri.query(domain);
    const cid = metaRes.value.isSome ? metaRes.value.value : null;

    if (!cid) {
        console.error(`  App "${domain}" not found or has no metadata.`);
        process.exit(1);
    }

    const metadata = await fetchJson<AppMetadata>(cid, gateway);
    console.log(`  ${metadata.name ?? domain}`);
    if (metadata.description) console.log(`  ${metadata.description}`);
    if (metadata.repository) console.log(`  ${metadata.repository}`);

    // TODO: clone + setup
    console.log("\n  TODO: clone + setup");
}

function interactiveBrowse(registry: any): Promise<void> {
    return new Promise((resolve) => {
        const app = render(
            React.createElement(AppBrowser, {
                registry,
                onSelect: (selected: AppEntry) => {
                    app.unmount();
                    console.log(`\n  Selected: ${selected.domain}`);
                    if (selected.repository) {
                        console.log(`  Repo: ${selected.repository}`);
                    }
                    // TODO: clone + setup
                    console.log("  TODO: clone + setup");
                    resolve();
                },
            }),
        );
    });
}
