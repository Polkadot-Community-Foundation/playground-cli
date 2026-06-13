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

import { describe, expect, it } from "vitest";
import { shouldShowTutorialPrompt } from "./tutorialPromptHint.js";

describe("shouldShowTutorialPrompt", () => {
    it("shows the prompt for the hardcoded tutorial app domain", () => {
        expect(
            shouldShowTutorialPrompt({ domain: "playground-tutorial.dot", startedTutorial: false }),
        ).toBe(true);
    });

    it("ignores startedTutorial; gates purely on the domain", () => {
        // A quest track started on some other app must NOT surface the nudge.
        expect(
            shouldShowTutorialPrompt({ domain: "some-other-app.dot", startedTutorial: true }),
        ).toBe(false);
    });

    it("stays generic for any other app", () => {
        expect(shouldShowTutorialPrompt({ domain: "cool-app.dot", startedTutorial: false })).toBe(
            false,
        );
    });
});
