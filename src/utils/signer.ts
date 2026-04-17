/**
 * Unified signer resolution — "give me a PolkadotSigner, I don't care how."
 *
 * Dev accounts (--suri //Alice) and QR mobile sessions both produce
 * the same PolkadotSigner interface. Commands call `resolveSigner()`
 * once at startup and thread the result through all operations.
 */

import { ss58Encode } from "@polkadot-apps/address";
import { createDevSigner, getDevPublicKey, type DevAccountName } from "@polkadot-apps/tx";
import type { PolkadotSigner } from "polkadot-api";
import { getSessionSigner, type SessionHandle } from "./auth.js";

// ── Types ────────────────────────────────────────────────────────────────────

export type SignerSource = "dev" | "session";

export interface ResolvedSigner {
    signer: PolkadotSigner;
    address: string;
    source: SignerSource;
    /** Tear down session adapter. Call in finally block. No-op for dev signers. */
    destroy(): void;
}

export interface SignerOptions {
    /** Secret URI like "//Alice". Takes priority over session. */
    suri?: string;
}

// ── Errors ───────────────────────────────────────────────────────────────────

export class SignerNotAvailableError extends Error {
    constructor() {
        super('No signer available. Run "dot init" to log in, or pass --suri //Alice for dev.');
        this.name = "SignerNotAvailableError";
    }
}

// ── Helpers ──────────────────────────────────────────────────────────────────

const DEV_NAMES: readonly DevAccountName[] = ["Alice", "Bob", "Charlie", "Dave", "Eve", "Ferdie"];

export function parseDevAccountName(suri: string): DevAccountName | null {
    const name = suri.replace(/^\/\//, "");
    return DEV_NAMES.find((n) => n.toLowerCase() === name.toLowerCase()) ?? null;
}

// ── Main ─────────────────────────────────────────────────────────────────────

/**
 * Resolve a PolkadotSigner.
 *
 *   1. --suri flag → dev signer
 *   2. Persisted QR session → session signer (via auth.ts getSessionSigner)
 *   3. Neither → SignerNotAvailableError
 */
export async function resolveSigner(options?: SignerOptions): Promise<ResolvedSigner> {
    if (options?.suri) {
        const devName = parseDevAccountName(options.suri);
        if (!devName) {
            throw new Error(
                `Unrecognized SURI "${options.suri}". ` + `Supported: ${DEV_NAMES.join(", ")}`,
            );
        }
        return {
            signer: createDevSigner(devName),
            address: ss58Encode(getDevPublicKey(devName)),
            source: "dev",
            destroy() {},
        };
    }

    const session = await getSessionSigner();
    if (session) {
        return { ...session, source: "session" };
    }

    throw new SignerNotAvailableError();
}
