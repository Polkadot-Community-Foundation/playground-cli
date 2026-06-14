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
 * Shared moddable TUI stages — the async git-origin preflight and the
 * "setup needed" recovery menu. Used by both `playground deploy` and
 * `playground decentralize --path`'s interactive flows; the underlying
 * checks live in `src/utils/deploy/moddable.ts` (no React there — these
 * components are the Ink layer on top).
 */

import { useEffect, useState } from "react";
import { Box, Text, useInput } from "ink";
import { Callout, Row, Section, Select } from "../../utils/ui/theme/index.js";
import {
    ensureGitInstalled,
    ModdablePreflightError,
    resolveRepositoryUrl,
} from "../../utils/deploy/moddable.js";

// ── Moddable preflight ────────────────────────────────────────────────────────

export function ModdablePreflightStage({
    projectDir,
    onResolved,
    onError,
}: {
    projectDir: string;
    onResolved: (url: string) => void;
    onError: (message: string) => void;
}) {
    const [status, setStatus] = useState<string>("checking git…");

    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                setStatus("ensuring git is installed…");
                await ensureGitInstalled();
                if (cancelled) return;

                setStatus("resolving repository…");
                const url = await resolveRepositoryUrl({
                    cwd: projectDir,
                    onLog: (line) => {
                        if (!cancelled) setStatus(line);
                    },
                });
                if (cancelled) return;
                onResolved(url);
            } catch (err) {
                if (cancelled) return;
                const message =
                    err instanceof ModdablePreflightError
                        ? err.interactiveMessage
                        : err instanceof Error
                          ? err.message
                          : String(err);
                onError(message);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [projectDir]);

    return (
        <Section>
            <Row mark="run" label={status} tone="muted" />
        </Section>
    );
}

type ModdableErrorChoice = "continue" | "exit";

/**
 * Formal warning stage shown when the moddable preflight cannot proceed,
 * almost always because the user hasn't set up a public GitHub `origin` yet.
 * Renders the actionable error inside a yellow Callout (matching the
 * "check your phone" banner) so it visually registers as a setup requirement
 * rather than a deploy crash. Must never dead-end (#332): the menu offers
 * continuing as non-moddable or a graceful exit. Esc also exits, matching the
 * Ack and Confirm stages (and the previous incarnation of this screen).
 */
export function ModdableErrorStage({
    message,
    onContinueWithoutModdable,
    onExit,
}: {
    message: string;
    onContinueWithoutModdable: () => void;
    onExit: () => void;
}) {
    useInput((_input, key) => {
        if (key.escape) onExit();
    });
    return (
        <Box flexDirection="column">
            <Callout tone="warning" title="Moddable Setup Needed">
                <Text>{message}</Text>
            </Callout>
            <Box marginTop={1} flexDirection="column">
                <Select<ModdableErrorChoice>
                    label="how do you want to continue?"
                    options={[
                        {
                            value: "continue",
                            label: "continue without moddable",
                            hint: "publish, but keep my source private",
                        },
                        {
                            value: "exit",
                            label: "exit",
                            hint: "set up GitHub first, re-run deploy later",
                        },
                    ]}
                    initialIndex={0}
                    onSelect={(choice) => {
                        if (choice === "continue") onContinueWithoutModdable();
                        else onExit();
                    }}
                />
            </Box>
        </Box>
    );
}
