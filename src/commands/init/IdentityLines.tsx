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
import { formatUsernameLine, lookupUsername, type UsernameLookup } from "../../utils/username.js";

/**
 * Three-line identity block shown after a successful login:
 *
 *   logged in       <wallet root SS58>
 *   username        alice.dot
 *   product account <product SS58> (<product 0x H160>)
 *
 * `logged in` is the SSO-handshake `rootAccountId` (bare-mnemonic on
 * current mobile builds). It is the storage key for the username
 * lookup. It is NOT the same address mobile shows as "Wallet account"
 * on its debug screen — that uses the hard `//wallet` derivation which
 * the host can't reproduce.
 *
 * `product account` is the playground-scoped account derived via
 * `product/playground.dot/0` off the root; this is what signs txs on
 * the CLI. The SS58 + H160 are taken straight off the auth-derived
 * pair so they never drift — the bug we had previously was running
 * `deriveProductAccountPublicKey` again on the already-derived SS58
 * and producing a doubly-derived ghost address.
 *
 * The username lookup is async (queries People parachain) and has a
 * 10s timeout inside `lookupUsername`. A `(looking up...)` placeholder
 * renders while the lookup is in flight; failures and missing
 * identities fall through to the strings from `formatUsernameLine`.
 */
export function IdentityLines({ addresses }: { addresses: SessionAddresses }) {
    const [username, setUsername] = useState<UsernameLookup>({ kind: "loading" });

    useEffect(() => {
        let cancelled = false;
        lookupUsername(addresses.rootAddress).then((result) => {
            if (!cancelled) setUsername(result);
        });
        return () => {
            cancelled = true;
        };
    }, [addresses.rootAddress]);

    const usernameTone = username.kind === "found" ? "default" : "muted";

    return (
        <Section>
            <Row mark="ok" label="logged in" value={addresses.rootAddress} tone="muted" />
            <Row
                mark="ok"
                label="username"
                value={formatUsernameLine(username)}
                tone={usernameTone}
            />
            <Row
                mark="ok"
                label="product account"
                value={`${addresses.productAddress} (${addresses.productH160})`}
                tone="muted"
            />
        </Section>
    );
}
