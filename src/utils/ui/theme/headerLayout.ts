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
 * Pure layout math for the Header breadcrumb.
 *
 * Why this exists: the header row is width-capped (LAYOUT.ruleWidthMax), and
 * a long domain pushes the content past the cap. When that happened, yoga
 * distributed the shrink across EVERY Text node, producing garbage like
 * `playground deplo  ·  devsignerutkplayground.do  · paseo next v2v0.28.5`
 * — a clipped command, a domain missing the final "t" of ".dot", and the
 * version label glued to the network with no gap. Pre-computing the layout
 * here guarantees the left side always fits, so yoga never shrinks anything.
 *
 * Degradation order, mildest first:
 *   1. narrow the piece separator from "  ·  " to " · "
 *   2. shrink the gap before the right label from 2 spaces to 1
 *   3. middle-truncate the username, then the subtitle/domain, down to a
 *      legible floor (middle-truncation keeps the ".dot" suffix visible)
 *   4. truncate them below the floor if the row is still too tight
 *   5. drop the username, then the subtitle, entirely
 * The cmd and network labels are never cut — they're short and fixed.
 */

export const SEPARATOR_WIDE = "  ·  ";
export const SEPARATOR_NARROW = " · ";
/** Preferred gap between the breadcrumb and the right-aligned label. */
export const RIGHT_GAP = 2;
/** Tightest acceptable gap — losing a domain char to widen the gap is worse. */
export const RIGHT_GAP_MIN = 1;
const ELLIPSIS = "…";
/** Don't shrink a piece below this — an 11-char stub plus "…" stays legible. */
const MIN_PIECE = 12;
/** Hard floor for the below-MIN_PIECE emergency pass. */
const ABS_MIN_PIECE = 5;

export interface HeaderParts {
    cmd: string;
    subtitle?: string;
    network?: string;
    username?: string;
}

export interface HeaderLayout {
    /** Breadcrumb pieces, possibly truncated, in render order. */
    pieces: string[];
    /** Separator to join them with. */
    separator: string;
}

export function layoutHeader(
    parts: HeaderParts,
    right: string | undefined,
    width: number,
): HeaderLayout {
    const budgetAt = (gap: number) => Math.max(0, width - (right ? right.length + gap : 0));

    const piecesOf = (p: HeaderParts) =>
        [p.cmd, p.subtitle, p.network, p.username].filter((v): v is string => Boolean(v));
    const widthOf = (p: HeaderParts, separator: string) => piecesOf(p).join(separator).length;

    const comfortable = budgetAt(RIGHT_GAP);
    if (widthOf(parts, SEPARATOR_WIDE) <= comfortable)
        return { pieces: piecesOf(parts), separator: SEPARATOR_WIDE };
    if (widthOf(parts, SEPARATOR_NARROW) <= comfortable)
        return { pieces: piecesOf(parts), separator: SEPARATOR_NARROW };

    const tight = budgetAt(RIGHT_GAP_MIN);
    const current: HeaderParts = { ...parts };
    // Username first (least load-bearing), then the subtitle/domain. Two
    // truncation passes: down to the legible floor, then — only if the row is
    // still too tight — below it.
    const shrinkable: Array<"username" | "subtitle"> = ["username", "subtitle"];
    for (const floor of [MIN_PIECE, ABS_MIN_PIECE]) {
        for (const key of shrinkable) {
            const value = current[key];
            if (!value) continue;
            const overflow = widthOf(current, SEPARATOR_NARROW) - tight;
            if (overflow <= 0) break;
            current[key] = truncateMiddle(value, Math.max(floor, value.length - overflow));
        }
    }
    // Last resort: drop the squeezable pieces entirely.
    for (const key of shrinkable) {
        if (widthOf(current, SEPARATOR_NARROW) <= tight) break;
        current[key] = undefined;
    }

    // If a pathologically narrow terminal STILL overflows (cmd + network
    // alone don't fit), the Header's wrap="truncate-end" backstop clips the
    // remainder at render time.
    return { pieces: piecesOf(current), separator: SEPARATOR_NARROW };
}

/**
 * `devsigner-very-long-name.dot` → `devsign…ame.dot`: keeps both ends, so a
 * domain's ".dot" suffix stays visible no matter how hard we squeeze.
 */
function truncateMiddle(value: string, max: number): string {
    if (value.length <= max) return value;
    const keep = max - ELLIPSIS.length;
    const front = Math.ceil(keep / 2);
    const back = keep - front;
    return value.slice(0, front) + ELLIPSIS + value.slice(value.length - back);
}
