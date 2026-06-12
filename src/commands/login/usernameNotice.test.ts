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
import { USERNAME_XP_REWARD, USERNAME_XP_TITLE, USERNAME_XP_BODY } from "./usernameNotice.js";

describe("username XP notice", () => {
    it("has a non-empty title and body", () => {
        expect(USERNAME_XP_TITLE.trim()).not.toBe("");
        expect(USERNAME_XP_BODY.trim()).not.toBe("");
    });

    it("states the XP reward, single-sourced from the constant", () => {
        expect(USERNAME_XP_TITLE).toContain(String(USERNAME_XP_REWARD));
        expect(USERNAME_XP_BODY).toContain(String(USERNAME_XP_REWARD));
        expect(USERNAME_XP_BODY.toLowerCase()).toContain("xp");
        expect(USERNAME_XP_BODY.toLowerCase()).toContain("username");
    });

    // Em dashes read as machine-written; the house copy stays free of them.
    it("uses no em dashes", () => {
        expect(USERNAME_XP_TITLE).not.toContain("—");
        expect(USERNAME_XP_BODY).not.toContain("—");
    });
});
