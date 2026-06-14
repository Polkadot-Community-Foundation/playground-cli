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
 * Cursor-navigation helpers for {@link Select}, factored out of the `.tsx` so
 * they can be unit-tested without rendering Ink. They operate on the minimal
 * `{ disabled?: boolean }` shape so the logic stays decoupled from the full
 * `SelectOption` type.
 */

/** First selectable index at or after `start`, wrapping; falls back to `start` if all are disabled. */
export function firstEnabledIndex(
    options: readonly { disabled?: boolean }[],
    start: number,
): number {
    const n = options.length;
    for (let step = 0; step < n; step++) {
        const i = (start + step) % n;
        if (!options[i].disabled) return i;
    }
    return start;
}

/** Next selectable index from `from` in direction `dir` (+1/-1), wrapping past disabled options. */
export function nextEnabledIndex(
    options: readonly { disabled?: boolean }[],
    from: number,
    dir: 1 | -1,
): number {
    const n = options.length;
    let i = from;
    for (let step = 0; step < n; step++) {
        i = (i + dir + n) % n;
        if (!options[i].disabled) return i;
    }
    return from;
}
