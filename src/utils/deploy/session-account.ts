/**
 * On-disk session key used to sign `Revive.instantiate_with_code` calls for
 * the contracts deploy phase.
 *
 * Why: mobile signing can't handle the wire size of a batched contract deploy
 * today, and the failure mode gets miscategorised (the phone's error message
 * contains "rejected" → `@polkadot-apps/tx` classifies it as a user-cancel,
 * discarding the real cause). A local sr25519 key, funded once by the user's
 * main signer, sidesteps the mobile-signing path entirely for the only phase
 * that currently breaks under it.
 *
 * Persistence:
 *   `$POLKADOT_ROOT/accounts.json` — defaults to `~/.polkadot/accounts.json`.
 *   A single `{ "default": "<bip39 mnemonic>" }` entry (that key name is
 *   `SessionKeyManager`'s default). File written with mode 0600 and a 0700
 *   parent directory so the BIP39 phrase isn't readable by other local users.
 *   Override `POLKADOT_ROOT` in tests and short-lived environments.
 *
 * Scope is deliberately single-account: one key, any network. cdm's
 * `~/.cdm/accounts.json` partitions by chain name ("paseo", "polkadot") —
 * we don't today because (a) the only supported target is paseo-asset-hub,
 * (b) adding `{ "<chain>": { mnemonic } }` later is a trivial schema
 * migration on read. Revisit when mainnet lands.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, resolve } from "node:path";
import { SessionKeyManager, type SessionKeyInfo } from "@polkadot-apps/keys";
import type { KvStore } from "@polkadot-apps/storage";

export type { SessionKeyInfo };

/** Root directory for playground-cli user state. Override with `$POLKADOT_ROOT`. */
export function defaultRoot(): string {
    return process.env.POLKADOT_ROOT ?? resolve(homedir(), ".polkadot");
}

function accountsPath(root = defaultRoot()): string {
    return resolve(root, "accounts.json");
}

/**
 * Filesystem-backed KvStore. `@polkadot-apps/storage` ships browser- and
 * host-targeted implementations but not a plain-file one; this fills that
 * gap so `SessionKeyManager` persists into a single JSON document the user
 * can inspect.
 *
 * Implementation is eager-load / full-rewrite on every call. That's fine —
 * the store is tiny and we only touch it at the start of the contracts phase.
 */
class FileKvStore implements KvStore {
    constructor(private readonly path: string) {}

    private readAll(): Record<string, string> {
        if (!existsSync(this.path)) return {};
        try {
            const parsed = JSON.parse(readFileSync(this.path, "utf8"));
            // Defensive: only accept string-valued objects, ignore anything else.
            if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
                const out: Record<string, string> = {};
                for (const [k, v] of Object.entries(parsed)) {
                    if (typeof v === "string") out[k] = v;
                }
                return out;
            }
        } catch {}
        return {};
    }

    private writeAll(obj: Record<string, string>): void {
        mkdirSync(dirname(this.path), { recursive: true, mode: 0o700 });
        writeFileSync(this.path, `${JSON.stringify(obj, null, 2)}\n`, { mode: 0o600 });
    }

    async get(key: string): Promise<string | null> {
        return this.readAll()[key] ?? null;
    }

    async set(key: string, value: string): Promise<void> {
        const obj = this.readAll();
        obj[key] = value;
        this.writeAll(obj);
    }

    async remove(key: string): Promise<void> {
        const obj = this.readAll();
        delete obj[key];
        this.writeAll(obj);
    }

    async getJSON<T>(key: string): Promise<T | null> {
        const raw = await this.get(key);
        return raw === null ? null : (JSON.parse(raw) as T);
    }

    async setJSON(key: string, value: unknown): Promise<void> {
        await this.set(key, JSON.stringify(value));
    }
}

/**
 * Peek at the persisted session key without generating one on a miss.
 * Returns `null` when no key has been minted yet. Callers that only need
 * the address to read on-chain state (balance, mapping) should use this —
 * creating a key speculatively would burn the one-shot mint-path the real
 * deploy uses to gate `Revive.map_account`.
 */
export async function readSessionAccount(): Promise<SessionKeyInfo | null> {
    const store = new FileKvStore(accountsPath());
    const manager = new SessionKeyManager({ store });
    return manager.get();
}

/**
 * Load the persisted contracts session key, or generate + save a fresh one
 * on first call. The returned `SessionKeyInfo.info` includes a `PolkadotSigner`
 * that can be passed straight to `ContractDeployer`.
 *
 * `created` is `true` only on the call that minted the key — callers use this
 * to gate one-time on-chain bootstrap (`Revive.map_account`) without having
 * to query chain state to tell cold starts apart from returning users.
 */
export async function getOrCreateSessionAccount(): Promise<{
    info: SessionKeyInfo;
    created: boolean;
}> {
    const store = new FileKvStore(accountsPath());
    const manager = new SessionKeyManager({ store });
    const existing = await manager.get();
    if (existing) return { info: existing, created: false };
    return { info: await manager.create(), created: true };
}
