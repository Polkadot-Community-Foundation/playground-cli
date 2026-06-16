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
import { AccountSetup } from "./AccountSetup.js";
import { NextSteps } from "./NextStepsCallout.js";
import { computeAllDone } from "./completion.js";
import { VERSION_LABEL } from "../../utils/version.js";
import { getNetworkLabel } from "../../config.js";
import type { SessionAddresses } from "../../utils/auth.js";

export function LoginScreen({
    addresses,
    freshlyPaired,
    onDone,
}: {
    // Auth is fully resolved before this screen mounts (the QR scan happens in
    // the pre-Ink scan phase, see qrScanPhase.ts), so `addresses` is fixed here.
    addresses: SessionAddresses | null;
    // True when this run just paired a phone, so AccountSetup waits out the
    // phone's "Connecting device" modal and grants allowances.
    freshlyPaired: boolean;
    onDone: () => void;
}) {
    const [depsComplete, setDepsComplete] = useState(false);
    const [accountComplete, setAccountComplete] = useState(false);
    const [accountOk, setAccountOk] = useState(true);

    const allDone = computeAllDone({
        needsQr: false,
        authResolved: true,
        loggedInAddress: addresses?.productAddress ?? null,
        depsComplete,
        accountComplete,
    });

    const handleDepsDone = () => {
        setDepsComplete(true);
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
            <Header cmd="playground login" network={getNetworkLabel()} right={VERSION_LABEL} />

            {addresses && <IdentityLines addresses={addresses} />}

            <DependencyList onDone={handleDepsDone} />

            {addresses && depsComplete && (
                <AccountSetup
                    address={addresses.productAddress}
                    freshlyPaired={freshlyPaired}
                    onDone={handleAccountDone}
                />
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

            {allDone && <NextSteps />}
        </Box>
    );
}
