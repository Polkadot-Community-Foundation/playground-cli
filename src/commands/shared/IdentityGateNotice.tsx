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

import React, { useEffect } from "react";
import { render, Text } from "ink";
import { Callout } from "../../utils/ui/theme/index.js";
import type { BlockedIdentityStatus } from "../../utils/identity/identityGate.js";
import { identityGateCopy } from "./identityGateCopy.js";

/**
 * One-shot yellow callout shown when the builder-identity gate blocks a
 * command. No interaction: it paints once, then signals the host to unmount.
 */
export function IdentityGateNotice({
    status,
    onDone,
}: {
    status: BlockedIdentityStatus;
    onDone: () => void;
}) {
    // Defer the unmount one tick so Ink flushes the frame before teardown.
    useEffect(() => {
        const t = setTimeout(onDone, 0);
        return () => clearTimeout(t);
    }, [onDone]);

    const copy = identityGateCopy(status);
    return (
        <Callout tone="warning" title={copy.title}>
            {copy.lines.map((line, i) => (
                // Blank entries are intentional spacers; Ink collapses an empty
                // string, so render a single space (matches the drip screen).
                <Text key={i}>{line === "" ? " " : line}</Text>
            ))}
        </Callout>
    );
}

/**
 * Render the blocked-gate notice once and resolve after it has been shown and
 * torn down. Mirrors the `status`/`drip` render/`waitUntilExit` shape.
 */
export function renderIdentityGateNotice(status: BlockedIdentityStatus): Promise<void> {
    return new Promise((resolve) => {
        const app = render(
            React.createElement(IdentityGateNotice, {
                status,
                onDone: () => app.unmount(),
            }),
        );
        void app.waitUntilExit().then(() => resolve());
    });
}
