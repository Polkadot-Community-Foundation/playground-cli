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

import { useCallback, useEffect, useState } from "react";
import { Box, Text, useInput, useStdout } from "ink";
import { COLOR, Hint, Mark } from "../../utils/ui/theme/index.js";
import type { GitHubRepoRef } from "../../utils/mod/source.js";
import {
    fetchQuestsManifest,
    type QuestEntry,
    type QuestsManifest,
} from "../../utils/mod/quests.js";
import { pad, formatDifficulty, findStartQuestIndex } from "./questPickerFormat.js";

interface Props {
    repoRef: GitHubRepoRef;
    /** Branch to read `quests.json` from (defaults to `main`). */
    branch?: string;
    /**
     * Resolves once the user is done with the picker. `startedTutorial` is true
     * only when the user explicitly pressed "Start tutorial" on a real quest
     * track; it is false when the picker auto-skips (no `quests.json` / empty
     * manifest / parse error), so the caller can tailor the post-clone hint.
     */
    onDone: (startedTutorial: boolean) => void;
    /** User cancelled the whole flow. */
    onCancel: () => void;
}

const COL = { id: 16, title: 32, difficulty: 12 };
// Leading marker column; the greyed rows below get the same width in spaces so
// their id/title/difficulty columns stay aligned with the START row.
const START_MARKER = "› START: ";
const LEVEL_INDENT = " ".repeat(START_MARKER.length);

export function QuestPicker({ repoRef, branch, onDone, onCancel }: Props) {
    const { stdout } = useStdout();
    // Rows available for the greyed level lines (header + summary + hints ≈ 10).
    const viewH = Math.max((stdout?.rows ?? 24) - 10, 5);

    const [manifest, setManifest] = useState<QuestsManifest | null>(null);
    const [fetching, setFetching] = useState(true);

    const load = useCallback(async () => {
        try {
            const m = await fetchQuestsManifest(repoRef, { branch });
            // Skip the picker silently — and let the existing download flow
            // run — when there's no `quests.json` (not a quest track) OR the
            // manifest defines zero quests. The empty case must behave exactly
            // like the absent one; rendering a quest-less picker would dead-end
            // the whole `mod` (no start row, only `q` to quit).
            if (!m || m.quests.length === 0) {
                onDone(false);
                return;
            }
            setManifest(m);
        } catch {
            // Malformed manifest or transient error — same fall-through.
            onDone(false);
        } finally {
            setFetching(false);
        }
    }, [repoRef, branch, onDone]);

    useEffect(() => {
        load();
    }, [load]);

    const quests: QuestEntry[] = manifest?.quests ?? [];

    // The start row is the ONLY interactive element: Enter starts the
    // tutorial from anywhere, q quits. There is deliberately no cursor —
    // the other levels are display-only (grey), so there is nothing to
    // navigate to. This also removes the previous stale-cursor bug where rapid
    // arrow keypresses (several events between two renders) were lost.
    //
    // NOTE: `onDone()` carries no quest id — it just continues the existing
    // clone-of-`main` flow (same effect the old "Start tutorial" button had).
    // The level named in the START row is informational; we don't start that
    // specific level, so don't wire downstream logic to the displayed id.
    useInput((input, key) => {
        if (input === "q") {
            onCancel();
            return;
        }
        if (fetching || !manifest) return;
        if (key.return && quests.length > 0) onDone(true);
    });

    if (fetching) {
        return (
            <Box gap={1} paddingLeft={2}>
                <Mark kind="run" />
                <Text dimColor>
                    fetching quests.json from github.com/{repoRef.owner}/{repoRef.repo} (main)…
                </Text>
            </Box>
        );
    }

    if (!manifest || quests.length === 0) {
        return (
            <Box flexDirection="column" paddingLeft={2}>
                <Text dimColor>This track has no quests defined.</Text>
                <Box marginTop={1}>
                    <Hint>q quit</Hint>
                </Box>
            </Box>
        );
    }

    const startIndex = findStartQuestIndex(quests);
    const startQuest = quests[startIndex];
    // row() joins id/title/difficulty/notes with three "  " separators (6 cols);
    // the marker/indent prefix is subtracted separately via START_MARKER.length.
    const notesCol = Math.max(
        (stdout?.columns ?? 80) - START_MARKER.length - COL.id - COL.title - COL.difficulty - 6,
        10,
    );

    const row = (q: QuestEntry) => {
        const notes =
            q.depends_on && q.depends_on.length > 0 ? `needs: ${q.depends_on.join(", ")}` : "";
        return `${pad(q.id, COL.id)}  ${pad(q.title, COL.title)}  ${pad(
            formatDifficulty(q.difficulty),
            COL.difficulty,
        )}  ${pad(notes, notesCol)}`;
    };

    // Every quest other than the start row is shown greyed below it. These are
    // "locked" in the common linear-track case, but a track may declare several
    // dependency-free quests — only the first becomes the start row, so the
    // rest are not strictly locked. Keep the displayed copy neutral ("levels").
    // Rows beyond the viewport are summarised in one line instead of scrolled —
    // there is nothing to select among them anyway.
    const otherLevels = quests.filter((_, i) => i !== startIndex);
    const visibleLevels = otherLevels.slice(0, viewH);
    const hiddenCount = otherLevels.length - visibleLevels.length;

    return (
        <Box flexDirection="column" paddingLeft={2}>
            <Box marginBottom={1}>
                <Text>
                    Quest track:{" "}
                    <Text bold color={COLOR.accent}>
                        {manifest.title ?? manifest.track_id}
                    </Text>
                </Text>
            </Box>

            <Box>
                <Text bold color={COLOR.accent}>
                    {`${START_MARKER}${row(startQuest)}`}
                </Text>
            </Box>

            {visibleLevels.map((q) => (
                <Box key={q.id}>
                    <Text dimColor>{`${LEVEL_INDENT}${row(q)}`}</Text>
                </Box>
            ))}
            {hiddenCount > 0 && (
                <Box>
                    <Text dimColor>{`${LEVEL_INDENT}… ${hiddenCount} more levels`}</Text>
                </Box>
            )}

            {startQuest.summary && (
                <Box marginTop={1}>
                    <Text dimColor>↳ {startQuest.summary}</Text>
                </Box>
            )}

            <Box marginTop={1}>
                <Hint>⏎ start tutorial · q quit</Hint>
            </Box>
        </Box>
    );
}
