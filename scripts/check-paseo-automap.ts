// SPDX-License-Identifier: Apache-2.0
// Copyright (C) Parity Technologies (UK) Ltd.

/**
 * One-off verification script: confirm, against the LIVE paseo-next-v2 Asset Hub,
 * the on-chain facts the account-mapping design relies on. This targets
 * paseo-next-v2 ONLY (never summit) — the endpoint is hardcoded so it cannot be
 * pointed elsewhere by accident.
 *
 * It checks:
 *   1. `Revive.AutoMap` pallet constant — is auto-mapping actually enabled?
 *      (This is the load-bearing fact: when true, every account is mapped the
 *      instant it is created in `frame_system`, and the `map_account` extrinsic
 *      is a no-op.)
 *   2. `Revive.OriginalAccount` storage exists (the stateful H160 -> AccountId32 map).
 *   3. The PGAS gas asset's `is_sufficient` flag — if true, a PGAS credit alone
 *      creates (and therefore auto-maps) an account, with no native ED needed.
 *      Asset id defaults to the paseo-next-v2 PGAS id (2_000_000_000); pass a
 *      different id as argv[2] to probe another asset.
 *
 * Run with:  npx tsx scripts/check-paseo-automap.ts [pgasAssetId]
 *        or:  bun scripts/check-paseo-automap.ts [pgasAssetId]
 *
 * Uses `getUnsafeApi()` (metadata-driven, no descriptors) so it reads whatever
 * the chain actually exposes today, independent of our generated types.
 */

import { createClient } from "polkadot-api";
import { getWsProvider } from "polkadot-api/ws";

// Hardcoded: paseo-next-v2 Asset Hub. Do NOT parameterise — summit is off-limits.
const PASEO_NEXT_V2_ASSET_HUB = "wss://paseo-asset-hub-next-rpc.polkadot.io";

// paseo-next-v2's PGAS gas asset id (the metadata-less sufficient asset, ~121T
// supply, verified live 2026-06-11). PGASAssetId is NOT a `#[pallet::constant]`,
// so it is not readable from metadata — override via argv if it ever changes.
// (For reference, asset-hub-westend uses 80_716_583.)
const DEFAULT_PGAS_ASSET_ID = 2_000_000_000;

async function main(): Promise<void> {
    const pgasAssetId = process.argv[2]
        ? Number(process.argv[2])
        : DEFAULT_PGAS_ASSET_ID;

    console.log(`Connecting to paseo-next-v2 Asset Hub: ${PASEO_NEXT_V2_ASSET_HUB}\n`);
    const client = createClient(getWsProvider([PASEO_NEXT_V2_ASSET_HUB]));

    try {
        const api = client.getUnsafeApi();
        // Force metadata load so the dynamic constants/query trees are populated.
        await api.compatibilityToken;

        // --- 1. Revive.AutoMap constant ---------------------------------------
        let autoMap: boolean | "missing" = "missing";
        try {
            const constFn = api.constants?.Revive?.AutoMap;
            if (typeof constFn === "function") {
                autoMap = (await constFn()) as boolean;
            }
        } catch (err) {
            console.error("  (error reading Revive.AutoMap)", err);
        }

        // --- 2. Revive.OriginalAccount storage presence -----------------------
        const hasOriginalAccount =
            typeof api.query?.Revive?.OriginalAccount?.getValue === "function";

        // --- 3. PGAS asset sufficiency ----------------------------------------
        let pgas:
            | { exists: false }
            | { exists: true; isSufficient: boolean; raw: unknown } = {
            exists: false,
        };
        try {
            const assetQuery = api.query?.Assets?.Asset;
            if (assetQuery?.getValue) {
                const asset = await assetQuery.getValue(pgasAssetId);
                if (asset) {
                    pgas = {
                        exists: true,
                        // pallet-assets AssetDetails: `is_sufficient: bool`
                        isSufficient: Boolean(
                            (asset as { is_sufficient?: boolean }).is_sufficient,
                        ),
                        raw: asset,
                    };
                }
            }
        } catch (err) {
            console.error("  (error reading Assets.Asset)", err);
        }

        // --- Report -----------------------------------------------------------
        console.log("=== paseo-next-v2 account-mapping facts ===\n");

        console.log(`1. Revive.AutoMap constant : ${String(autoMap)}`);
        if (autoMap === true) {
            console.log(
                "   -> Auto-mapping is ON. Any account is mapped the instant it is\n" +
                    "      created in frame_system. `map_account` is a no-op here.",
            );
        } else if (autoMap === false) {
            console.log(
                "   -> Auto-mapping is OFF. Accounts must call `map_account` explicitly\n" +
                    "      (and pay the mapping deposit) after they exist + have funds.",
            );
        } else {
            console.log(
                "   -> NOT FOUND. Either the Revive pallet or its AutoMap constant is\n" +
                    "      absent from this runtime's metadata.",
            );
        }

        console.log(
            `\n2. Revive.OriginalAccount  : ${hasOriginalAccount ? "present" : "MISSING"}`,
        );

        console.log(`\n3. PGAS asset #${pgasAssetId}:`);
        if (!pgas.exists) {
            console.log(
                "   -> NOT FOUND at this id. PGAS may use a different asset id on\n" +
                    "      paseo-next-v2 — re-run with the correct id as argv[2].",
            );
        } else {
            console.log(`   exists       : true`);
            console.log(`   is_sufficient: ${pgas.isSufficient}`);
            if (pgas.isSufficient) {
                console.log(
                    "   -> A PGAS credit ALONE creates the account (inc_sufficients) and,\n" +
                        "      with AutoMap on, auto-maps it. No native ED required.",
                );
            } else {
                console.log(
                    "   -> NOT sufficient: holding only PGAS will NOT create/keep the\n" +
                        "      account. A native ED credit would still be required.",
                );
            }
        }

        console.log("\n=== bottom line ===");
        if (autoMap === true && pgas.exists && pgas.isSufficient) {
            console.log(
                "Crediting a fresh product account with PGAS both funds its gas AND\n" +
                    "auto-maps it in one shot — the native dev-funding step can be replaced.",
            );
        } else if (autoMap === true) {
            console.log(
                "Auto-map is on, so creating the account (any credit) maps it. PGAS\n" +
                    "sufficiency unconfirmed at the id checked — verify the asset id.",
            );
        } else {
            console.log(
                "Re-examine: auto-map is not confirmed on, so the current funding +\n" +
                    "explicit-map model may be required. See script output above.",
            );
        }
    } finally {
        client.destroy();
    }
}

main()
    .then(() => process.exit(0))
    .catch((err) => {
        console.error(err);
        process.exit(1);
    });
