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
 * The canonical playground tag set.
 *
 * Each published app carries at most ONE tag, stored in the off-chain metadata
 * JSON as `tag` (a string) — see `buildMetadata` in `./playground.ts`. The
 * playground-app reads `metadata.tag` and filters apps by exact,
 * case-insensitive equality against a hardcoded pill list. That pill list is
 * the source of truth and lives in the OTHER repo:
 * `playground-app/src/App.tsx` (`export const TAGS`).
 *
 * There is no shared package between the two repos, so this list must be kept
 * in sync by hand. A tag that is NOT in the app's `TAGS` still renders on the
 * app card but has no filter pill, so it is effectively unfilterable — which is
 * why `playground deploy` only offers these predefined values (no free-form
 * custom tag).
 */
export const PLAYGROUND_TAGS = [
    "social",
    "chat",
    "defi",
    "utility",
    "gaming",
    "marketplace",
    "irl",
] as const;

export type PlaygroundTag = (typeof PLAYGROUND_TAGS)[number];

/** Type guard: is `value` one of the canonical playground tags (exact match)? */
export function isPlaygroundTag(value: string): value is PlaygroundTag {
    return (PLAYGROUND_TAGS as readonly string[]).includes(value);
}
