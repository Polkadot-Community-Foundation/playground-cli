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
 * Wraps a `PolkadotSigner` so the TUI can render a "check your phone" panel
 * around each signing call. We cannot infer this from polkadot-app-deploy's
 * stdout (the log is printed before the signer is invoked and gives no
 * completion hook), so the reliable place to hook is the signer itself.
 */

import type { PolkadotSigner } from "polkadot-api";
import type { AllowancePrompt } from "../allowances/bulletin.js";

export type SigningEvent =
    | { kind: "sign-request"; label: string; step: number }
    | { kind: "sign-complete"; label: string; step: number }
    | { kind: "sign-error"; label: string; step: number; message: string };

export interface SigningCounter {
    /** Reserve the next step number. */
    next(): { step: number };
    /** How many steps were reserved so far — useful for a final tally. */
    count(): number;
}

/**
 * Sequential tap counter shared across a whole deploy run. Deliberately has
 * NO predicted total: the pre-deploy approvals plan regularly diverged from
 * what polkadot-app-deploy actually submitted (e.g. a predicted `setUserPopStatus`
 * that runtime skipped left users on "step 4 of 5" with no fifth step), and
 * RFC-0010 allowance taps are demand-driven so they can't be counted up
 * front. The UI shows "step 1", "step 2", … and never has to guess.
 */
export function createSigningCounter(): SigningCounter {
    let step = 0;
    return {
        next() {
            step += 1;
            return { step };
        },
        count() {
            return step;
        },
    };
}

export interface WrapOptions {
    /** Human-readable label that names what the user is approving (shown on-screen). */
    label: string;
    /** Step counter shared across a whole deploy run so "2 of 4" counts correctly. */
    counter: SigningCounter;
    /** Sink for the signing lifecycle events. */
    onEvent: (event: SigningEvent) => void;
}

/**
 * Returns a new `PolkadotSigner` that mirrors `inner` but emits lifecycle
 * events around each signing call. The wrapper does NOT swallow errors — the
 * original rejection still propagates — it only surfaces them to `onEvent`
 * so the TUI can render a red banner.
 */
export function wrapSignerWithEvents(inner: PolkadotSigner, options: WrapOptions): PolkadotSigner {
    const announce = async <T>(fn: () => Promise<T>): Promise<T> => {
        const { step } = options.counter.next();
        options.onEvent({ kind: "sign-request", label: options.label, step });
        try {
            const value = await fn();
            options.onEvent({ kind: "sign-complete", label: options.label, step });
            return value;
        } catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            options.onEvent({ kind: "sign-error", label: options.label, step, message });
            throw err;
        }
    };

    return {
        publicKey: inner.publicKey,
        signTx: (callData, signedExtensions, metadata, atBlockNumber, hasher) =>
            announce(() =>
                inner.signTx(callData, signedExtensions, metadata, atBlockNumber, hasher),
            ),
        signBytes: (data) => announce(() => inner.signBytes(data)),
    };
}

/**
 * Prompt factory for phone taps that are NOT signer calls: RFC-0010
 * resource-allocation requests (the first-use Bulletin allowance grant). They
 * ride the statement store outside any `PolkadotSigner`, so
 * `wrapSignerWithEvents` never sees them — until this existed the phone
 * showed an approval dialog while the deploy TUI sat silent.
 *
 * The returned function implements
 * `allowances/bulletin.ts::AllowancePrompt`: call it right before sending the
 * request, then close the handle when the request resolves. Steps come from
 * the same shared counter as signing taps, so the user sees one continuous
 * "step 1, step 2, …" sequence across both kinds of approval.
 */
export function createApprovalPrompt(
    counter: SigningCounter,
    onEvent: (event: SigningEvent) => void,
): AllowancePrompt {
    return (label) => {
        const { step } = counter.next();
        onEvent({ kind: "sign-request", label, step });
        return {
            complete: () => onEvent({ kind: "sign-complete", label, step }),
            fail: (message) => onEvent({ kind: "sign-error", label, step, message }),
        };
    };
}
