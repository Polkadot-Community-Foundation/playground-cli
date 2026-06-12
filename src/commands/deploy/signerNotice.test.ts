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
import {
    NO_SESSION_NOTICE_TITLE,
    NO_SESSION_NOTICE_BODY,
    DEV_SIGNER_NO_XP_TITLE,
    DEV_SIGNER_NO_XP_BODY,
} from "./signerNotice.js";

describe("dev-signer XP notice", () => {
    it("has a non-empty title and body", () => {
        expect(DEV_SIGNER_NO_XP_TITLE.trim()).not.toBe("");
        expect(DEV_SIGNER_NO_XP_BODY.trim()).not.toBe("");
    });

    it("tells the user the dev signer earns no XP and the phone signer does", () => {
        const body = DEV_SIGNER_NO_XP_BODY.toLowerCase();
        expect(body).toContain("xp");
        expect(body).toContain("phone signer");
    });

    it("nudges not-logged-in users that logging in unlocks XP", () => {
        expect(NO_SESSION_NOTICE_BODY.toLowerCase()).toContain("xp");
    });

    // Em dashes read as machine-written; the house copy stays free of them.
    it("uses no em dashes anywhere in the signer-notice copy", () => {
        for (const [name, text] of Object.entries({
            NO_SESSION_NOTICE_TITLE,
            NO_SESSION_NOTICE_BODY,
            DEV_SIGNER_NO_XP_TITLE,
            DEV_SIGNER_NO_XP_BODY,
        })) {
            expect(text, name).not.toContain("—");
        }
    });
});
