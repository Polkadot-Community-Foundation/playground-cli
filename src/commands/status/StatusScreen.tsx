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
import { Box, Text } from "ink";
import { Header, Section, Row, Callout } from "../../utils/ui/theme/index.js";
import { VERSION_LABEL } from "../../utils/version.js";
import { getNetworkLabel } from "../../config.js";
import { getSessionSigner } from "../../utils/auth.js";
import { getConnection, destroyConnection } from "../../utils/connection.js";
import { formatPas, PAS_DECIMALS } from "../../utils/account/drip.js";
import { formatTokenAmount } from "../../utils/account/pgas.js";
import { humanizeDuration } from "../../utils/account/attestation.js";
import { staleSessionWarning } from "../../utils/loginStamp.js";
import { buildStatusReport, type StatusReport, type FieldResult } from "./gather.js";

/** Only `error` is a hard failure (exit 1); `needLogin` is a soft outcome. */
export type StatusOutcome = "ok" | "needLogin" | "error";

type Phase =
    | { kind: "loading" }
    | { kind: "ready"; report: StatusReport }
    | { kind: "needLogin" }
    | { kind: "error"; message: string };

export function StatusScreen({ onDone }: { onDone: (outcome: StatusOutcome) => void }) {
    const [phase, setPhase] = useState<Phase>({ kind: "loading" });

    useEffect(() => {
        let cancelled = false;
        const describe = (err: unknown): string =>
            err instanceof Error ? err.message : String(err);

        (async () => {
            let handle: Awaited<ReturnType<typeof getSessionSigner>>;
            try {
                handle = await getSessionSigner();
            } catch (err) {
                if (cancelled) return;
                setPhase({ kind: "error", message: describe(err) });
                onDone("error");
                return;
            }
            if (cancelled) {
                handle?.destroy();
                return;
            }
            if (!handle) {
                setPhase({ kind: "needLogin" });
                onDone("needLogin");
                return;
            }

            // The connection is best-effort: a failure still lets us show the
            // locally-derived addresses + login stamp (graceful degradation).
            let client: Awaited<ReturnType<typeof getConnection>> | null = null;
            try {
                client = await getConnection();
            } catch {
                client = null;
            }
            if (cancelled) {
                handle.destroy();
                return;
            }

            try {
                const report = await buildStatusReport(handle, client);
                if (cancelled) return;
                setPhase({ kind: "ready", report });
                onDone("ok");
            } catch (err) {
                if (cancelled) return;
                setPhase({ kind: "error", message: describe(err) });
                onDone("error");
            } finally {
                // We only read the session addresses + cached slot key; the
                // adapter's WebSocket is no longer needed. Release it so the
                // event loop can drain.
                handle.destroy();
            }
        })();

        return () => {
            cancelled = true;
            destroyConnection();
        };
    }, [onDone]);

    return (
        <Box flexDirection="column">
            <Header
                cmd="playground status"
                subtitle="polkadot playground"
                network={getNetworkLabel()}
                right={VERSION_LABEL}
            />
            <Body phase={phase} />
        </Box>
    );
}

function fieldText<T>(result: FieldResult<T>, render: (value: T) => string): string {
    return result.ok ? render(result.value) : "unavailable";
}

function Body({ phase }: { phase: Phase }) {
    switch (phase.kind) {
        case "loading":
            return (
                <Section gapBelow={false}>
                    <Row mark="run" label="status" value="gathering…" tone="muted" />
                </Section>
            );

        case "needLogin":
            return (
                <Callout tone="warning" title="Log in first">
                    <Text>
                        {"`playground status`"} reports on the account paired with your phone, so
                        you need to be signed in.
                    </Text>
                    <Text> </Text>
                    <Text>
                        Run <Text bold>playground login</Text> and scan the QR code with your
                        Polkadot mobile app, then try again.
                    </Text>
                </Callout>
            );

        case "error":
            return (
                <Callout tone="danger" title="Couldn't read your status">
                    <Text>{phase.message}</Text>
                    <Text> </Text>
                    <Text>Check your internet connection and try again.</Text>
                </Callout>
            );

        case "ready":
            return <ReadyBody report={phase.report} />;
    }
}

function ReadyBody({ report }: { report: StatusReport }) {
    const { addresses, nativeBalance, pgas, bulletin, loginStampMs } = report;

    const bulletinTone = bulletin.ok && bulletin.value ? bulletin.value.tone : "muted";
    const bulletinValue = bulletin.ok
        ? bulletin.value
            ? bulletin.value.text
            : "not granted"
        : "unavailable";

    const now = Date.now();
    const sessionAge = loginStampMs === null ? null : humanizeDuration(now - loginStampMs);
    const staleWarning = loginStampMs === null ? null : staleSessionWarning(loginStampMs, now);

    return (
        <Box flexDirection="column">
            <Section>
                <Row mark="ok" label="product" value={addresses.productAddress} />
                <Row label="H160" value={addresses.productH160} />
            </Section>
            <Section>
                <Row
                    label="balance"
                    value={fieldText(nativeBalance, (b) => formatPas(b))}
                    tone={nativeBalance.ok ? "default" : "muted"}
                />
                <Row
                    label="PGAS"
                    value={fieldText(pgas, (b) => formatTokenAmount(b, PAS_DECIMALS, "PGAS"))}
                    tone={pgas.ok ? "default" : "muted"}
                />
                <Row
                    label="bulletin"
                    value={bulletinValue}
                    tone={bulletinTone}
                    hint={
                        bulletin.ok && bulletin.value === null
                            ? "run `playground login` to grant Bulletin storage"
                            : undefined
                    }
                />
            </Section>
            {sessionAge && (
                <Section gapBelow={!staleWarning}>
                    <Row label="session" value={`paired ${sessionAge} ago`} tone="muted" />
                </Section>
            )}
            {staleWarning && (
                <Callout tone="warning" title="Session may be stale">
                    <Text>{staleWarning}</Text>
                </Callout>
            )}
        </Box>
    );
}
