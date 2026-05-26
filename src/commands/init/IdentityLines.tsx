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

import { useEffect, useState } from "react";
import { Row, Section } from "../../utils/ui/theme/index.js";
import type { SessionAddresses } from "../../utils/auth.js";
import {
    formatUsernameLine,
    lookupUsername,
    lookupRegistryUsername,
    type UsernameLookup,
} from "../../utils/username.js";
import { PLAYGROUND_PRODUCT_ID } from "../../config.js";

/**
 * Four-row identity block shown after a successful login:
 *
 *   logged in        <wallet root SS58>
 *   username         <name> (playground|polkadot)
 *   account in use   playground.dot/0 — <product 0x H160>
 *   product account  <product SS58>
 *
 * `logged in` is the SSO-handshake `rootAccountId` (bare-mnemonic on
 * current mobile builds). It is the storage key for the People-parachain
 * username lookup. It is NOT the same address mobile shows as "Wallet
 * account" on its debug screen — that uses the hard `//wallet`
 * derivation which the host can't reproduce.
 *
 * `username` follows a two-tier precedence, same first tier as the
 * playground-app's `displayNameForAccount`:
 *   1. registry username — the handle the user set in the playground-app
 *      profile (`registry.setUsername`), keyed on the product H160 since
 *      that's the `caller()` the contract records.
 *   2. People-parachain identity from `lookupUsername` — the chain-wide
 *      handle, keyed on the root SS58.
 * The source ("playground" vs "polkadot") is suffixed so it's obvious
 * which surface the user is seeing. If neither resolves, the row falls
 * through to `formatUsernameLine`'s `(no username set on chain)`.
 *
 * `account in use` surfaces the derivation slug + the H160 that signs
 * on the user's behalf, so the user can verify the exact account
 * without inspecting the SS58. `product account` keeps the SS58 form
 * on its own row.
 *
 * Both lookups are async, fired in parallel, each cancellable. The
 * People-parachain query has a 10s timeout inside `lookupUsername`;
 * the registry query degrades silently to `null` on any error
 * (`lookupRegistryUsername`) so older deploys without `getUsername`
 * fall through to tier 2 without surfacing an error to the user.
 *
 * The SS58 + H160 are taken straight off the auth-derived pair so
 * they never drift — the bug we had previously was running
 * `deriveProductAccountPublicKey` again on the already-derived SS58
 * and producing a doubly-derived ghost address.
 */
export function IdentityLines({ addresses }: { addresses: SessionAddresses }) {
    const [walletUsername, setWalletUsername] = useState<UsernameLookup>({ kind: "loading" });
    // null means "lookup completed, no registry username set"; undefined means
    // "still loading". Display rule: prefer registry > People > fall back to
    // the H160 — same precedence the playground-app uses in `displayNameForAccount`.
    const [registryUsername, setRegistryUsername] = useState<string | null | undefined>(undefined);

    useEffect(() => {
        let cancelled = false;
        lookupUsername(addresses.rootAddress).then((result) => {
            if (!cancelled) setWalletUsername(result);
        });
        lookupRegistryUsername(addresses.productH160 as `0x${string}`).then((result) => {
            if (!cancelled) setRegistryUsername(result);
        });
        return () => {
            cancelled = true;
        };
    }, [addresses.rootAddress, addresses.productH160]);

    const usernameLine = registryUsername
        ? registryUsername
        : registryUsername === undefined
          ? "(looking up...)"
          : formatUsernameLine(walletUsername);
    const usernameTone = registryUsername || walletUsername.kind === "found" ? "default" : "muted";
    const usernameSource = registryUsername
        ? "playground"
        : walletUsername.kind === "found"
          ? "polkadot"
          : null;

    return (
        <Section>
            <Row mark="ok" label="logged in" value={addresses.rootAddress} tone="muted" />
            <Row
                mark="ok"
                label="username"
                value={usernameSource ? `${usernameLine} (${usernameSource})` : usernameLine}
                tone={usernameTone}
            />
            <Row
                mark="ok"
                label="account in use"
                value={`${PLAYGROUND_PRODUCT_ID}/0 — ${addresses.productH160}`}
                tone="muted"
            />
            <Row mark="ok" label="product account" value={addresses.productAddress} tone="muted" />
        </Section>
    );
}
