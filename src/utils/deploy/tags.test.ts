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

import { describe, it, expect } from "vitest";
import { PLAYGROUND_TAGS, isPlaygroundTag } from "./tags.js";

describe("PLAYGROUND_TAGS", () => {
    it("mirrors the playground-app TAGS list exactly (keep in sync with App.tsx)", () => {
        // If this fails because the app added/removed/reordered a tag, update
        // both this list and the array in `playground-app/src/App.tsx`.
        expect([...PLAYGROUND_TAGS]).toEqual([
            "social",
            "chat",
            "defi",
            "utility",
            "gaming",
            "marketplace",
            "irl",
        ]);
    });
});

describe("isPlaygroundTag", () => {
    it("accepts a canonical tag", () => {
        expect(isPlaygroundTag("defi")).toBe(true);
    });

    it("rejects an unknown tag", () => {
        expect(isPlaygroundTag("productivity")).toBe(false);
    });

    it("is case-sensitive (the app stores canonical lowercase values)", () => {
        // The CLI only ever emits the lowercase canonical values (the flag is
        // validated against the list and the picker offers them verbatim), so
        // the guard need not normalise — it just confirms membership.
        expect(isPlaygroundTag("DeFi")).toBe(false);
    });
});
