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

import { useState, useEffect } from "react";
import { Box } from "ink";
import { Header, Row, Section } from "../../utils/ui/theme/index.js";
import { DependencyList } from "./DependencyList.js";
import { IdentityLines } from "./IdentityLines.js";
import { QrLogin } from "./QrLogin.js";
import { AccountSetup } from "./AccountSetup.js";
import { computeAllDone } from "./completion.js";
import { VERSION_LABEL } from "../../utils/version.js";
import { getNetworkLabel } from "../../config.js";
import type { LoginHandle, SessionAddresses } from "../../utils/auth.js";

export function InitScreen({
    login,
    existingAddresses,
    onDone,
}: {
    login: LoginHandle | null;
    existingAddresses: SessionAddresses | null;
    onDone: () => void;
}) {
    const needsQr = login !== null;
    const [addresses, setAddresses] = useState<SessionAddresses | null>(existingAddresses);
    const [authResolved, setAuthResolved] = useState(!needsQr);
    const [depsComplete, setDepsComplete] = useState(false);
    const [accountComplete, setAccountComplete] = useState(false);
    const [accountOk, setAccountOk] = useState(true);

    const allDone = computeAllDone({
        needsQr,
        authResolved,
        loggedInAddress: addresses?.productAddress ?? null,
        depsComplete,
        accountComplete,
    });

    const handleDepsDone = () => {
        setDepsComplete(true);
    };

    const handleAuthDone = (next: SessionAddresses | null) => {
        if (next) setAddresses(next);
        setAuthResolved(true);
    };

    const handleAccountDone = (success: boolean) => {
        setAccountOk(success);
        setAccountComplete(true);
    };

    useEffect(() => {
        if (allDone) onDone();
    }, [allDone]);

    return (
        <Box flexDirection="column">
            <Header
                cmd="dot init"
                subtitle="polkadot playground"
                network={getNetworkLabel()}
                right={VERSION_LABEL}
            />

            {needsQr && <QrLogin login={login} onDone={handleAuthDone} />}

            {addresses && <IdentityLines addresses={addresses} />}

            <DependencyList onDone={handleDepsDone} />

            {addresses && depsComplete && (
                <AccountSetup address={addresses.productAddress} onDone={handleAccountDone} />
            )}

            {allDone && (
                <Section gapBelow={false}>
                    <Row
                        mark="ok"
                        label="setup complete"
                        value={accountOk ? undefined : "some account setup steps failed"}
                        tone={accountOk ? "default" : "warning"}
                    />
                </Section>
            )}
        </Box>
    );
}
