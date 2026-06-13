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
import { decentralizeSignerOptions, decentralizeSignerInitialIndex } from "./signerPrompt.js";

describe("decentralizeSignerOptions", () => {
    it("leads with the phone signer, matching `playground deploy`", () => {
        expect(decentralizeSignerOptions(true).map((o) => o.value)).toEqual(["phone", "dev"]);
    });

    it("always shows both options, even without a session", () => {
        expect(decentralizeSignerOptions(false).map((o) => o.value)).toEqual(["phone", "dev"]);
    });

    it("points the user at `playground login` in the phone hint when not logged in", () => {
        const [phone] = decentralizeSignerOptions(false);
        expect(phone.hint).toContain("playground login");
    });
});

describe("decentralizeSignerInitialIndex", () => {
    it("defaults the cursor to the phone signer (index 0) when logged in", () => {
        expect(decentralizeSignerInitialIndex(true)).toBe(0);
    });

    it("defaults the cursor to the dev signer (index 1) when not logged in, so Enter never hits the login error", () => {
        expect(decentralizeSignerInitialIndex(false)).toBe(1);
    });
});
