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
 * Pure column-formatting helpers for the quest picker, lifted out of
 * `QuestPicker.tsx` so they can be unit-tested without dragging React/Ink
 * into vitest.
 */

/** Pad `s` to width `w`, truncating with an ellipsis when it overflows. */
export function pad(s: string, w: number): string {
    return s.length > w ? `${s.slice(0, w - 1)}…` : s.padEnd(w);
}

/** Render a 1–5 difficulty as filled stars; `—` when unset or non-positive. */
export function formatDifficulty(d: number | undefined): string {
    if (typeof d !== "number" || d <= 0) return "—";
    return "★".repeat(Math.min(d, 5));
}

/**
 * Index of the quest the learner can start right now: the first one with no
 * `depends_on`. The CLI has no completion tracking (mod always clones the
 * track's main), so dependency-free is the only "unlocked" signal available.
 * Falls back to the first quest when every entry declares dependencies, so a
 * malformed track still gets a start row instead of an all-locked dead end.
 */
export function findStartQuestIndex(quests: { depends_on?: string[] }[]): number {
    const i = quests.findIndex((q) => !q.depends_on || q.depends_on.length === 0);
    return i === -1 ? 0 : i;
}
