import {
    createClient,
    type ChainDefinition,
    type PolkadotClient,
    type TypedApi,
} from "polkadot-api";
import { getWsProvider } from "polkadot-api/ws";
import { bulletin } from "@parity/product-sdk-descriptors/bulletin";
import { individuality } from "@parity/product-sdk-descriptors/individuality";
import { paseo_asset_hub } from "@parity/product-sdk-descriptors/paseo-asset-hub";
import { getChainConfig } from "../config.js";

type PaseoChains = {
    assetHub: typeof paseo_asset_hub;
    bulletin: typeof bulletin;
    individuality: typeof individuality;
};

export type PaseoClient = {
    [K in keyof PaseoChains]: TypedApi<PaseoChains[K]>;
} & {
    raw: { [K in keyof PaseoChains]: PolkadotClient };
    destroy(): void;
};

/** If the direct PAPI clients don't resolve in this window we treat the attempt as dead. */
const CONNECT_TIMEOUT_MS = 30_000;

let connectionPromise: Promise<PaseoClient> | null = null;
let client: PaseoClient | null = null;

function createRawClient(endpoints: readonly string[]): PolkadotClient {
    return createClient(getWsProvider([...endpoints]));
}

function typedApi<T extends ChainDefinition>(raw: PolkadotClient, descriptor: T): TypedApi<T> {
    return raw.getTypedApi(descriptor);
}

async function connectPaseo(): Promise<PaseoClient> {
    const cfg = getChainConfig();
    const raw = {
        assetHub: createRawClient([cfg.assetHubRpc]),
        bulletin: createRawClient([cfg.bulletinRpc, ...cfg.bulletinRpcFallbacks]),
        individuality: createRawClient(cfg.peopleEndpoints),
    };

    let destroyed = false;
    return {
        assetHub: typedApi(raw.assetHub, paseo_asset_hub),
        bulletin: typedApi(raw.bulletin, bulletin),
        individuality: typedApi(raw.individuality, individuality),
        raw,
        destroy() {
            if (destroyed) return;
            destroyed = true;
            raw.assetHub.destroy();
            raw.bulletin.destroy();
            raw.individuality.destroy();
        },
    };
}

function timeoutAfter(ms: number): Promise<never> {
    return new Promise((_, reject) =>
        setTimeout(
            () =>
                reject(new Error(`Timed out connecting to Paseo after ${Math.round(ms / 1000)}s`)),
            ms,
        ),
    );
}

export function getConnection(): Promise<PaseoClient> {
    if (!connectionPromise) {
        connectionPromise = Promise.race([
            connectPaseo().then((c) => {
                client = c;
                return c;
            }),
            timeoutAfter(CONNECT_TIMEOUT_MS),
        ]).catch((err: unknown) => {
            // Reset so the next call can retry instead of replaying the error.
            connectionPromise = null;
            const detail = err instanceof Error ? err.message : String(err);
            throw new Error(
                `Could not connect to Paseo network — check your internet connection (${detail})`,
                { cause: err instanceof Error ? err : undefined },
            );
        });
    }
    return connectionPromise;
}

export function destroyConnection(): void {
    if (client) {
        client.destroy();
        client = null;
    }
    connectionPromise = null;
}
