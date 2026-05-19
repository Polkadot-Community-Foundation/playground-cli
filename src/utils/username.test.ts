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
import { formatUsernameLine, type UsernameLookup } from "./username.js";

describe("formatUsernameLine", () => {
    it("returns the full username when present", () => {
        const lookup: UsernameLookup = {
            kind: "found",
            fullUsername: "alice.dot",
            liteUsername: "alice",
        };
        expect(formatUsernameLine(lookup)).toBe("alice.dot");
    });

    it("falls back to the lite username when full is null", () => {
        const lookup: UsernameLookup = {
            kind: "found",
            fullUsername: null,
            liteUsername: "alice",
        };
        expect(formatUsernameLine(lookup)).toBe("alice");
    });

    it("returns '(no username set on chain)' when the account has no identity", () => {
        const lookup: UsernameLookup = { kind: "none" };
        expect(formatUsernameLine(lookup)).toBe("(no username set on chain)");
    });

    it("returns '(lookup failed)' on any lookup error", () => {
        const lookup: UsernameLookup = {
            kind: "error",
            reason: "endpoint unreachable",
        };
        expect(formatUsernameLine(lookup)).toBe("(lookup failed)");
    });

    it("returns '(looking up...)' while the lookup is pending", () => {
        const lookup: UsernameLookup = { kind: "loading" };
        expect(formatUsernameLine(lookup)).toBe("(looking up...)");
    });
});
