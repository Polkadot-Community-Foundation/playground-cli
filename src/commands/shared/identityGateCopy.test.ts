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
import { identityGateCopy } from "./identityGateCopy.js";
import type { BlockedIdentityStatus } from "../../utils/identity/identityGate.js";

const STATUSES: BlockedIdentityStatus[] = ["not-logged-in", "anonymous", "unverifiable"];

describe("identityGateCopy", () => {
    it("returns a non-empty title and body for every blocked status", () => {
        for (const status of STATUSES) {
            const copy = identityGateCopy(status);
            expect(copy.title.length).toBeGreaterThan(0);
            const body = copy.lines.filter((l) => l.trim().length > 0);
            expect(body.length).toBeGreaterThan(0);
        }
    });

    it("points not-logged-in at `playground login`", () => {
        const copy = identityGateCopy("not-logged-in");
        expect(copy.lines.join(" ")).toContain("playground login");
        expect(copy.lines.join(" ")).toContain("playground.dot");
    });

    it("tells anonymous builders to join the competition at playground.dot", () => {
        const copy = identityGateCopy("anonymous");
        expect(copy.lines.join(" ").toLowerCase()).toContain("become a builder");
        expect(copy.lines.join(" ")).toContain("playground.dot");
    });

    it("tells unverifiable users to confirm they joined, then retry", () => {
        const copy = identityGateCopy("unverifiable");
        const body = copy.lines.join(" ");
        expect(body).toContain("playground.dot");
        expect(body.toLowerCase()).toContain("try again");
    });
});
