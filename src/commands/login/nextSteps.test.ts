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
import { NEXT_STEPS } from "./nextSteps.js";

describe("NEXT_STEPS", () => {
    it("lists the three creative entry-point commands", () => {
        expect(NEXT_STEPS.map((s) => s.cmd)).toEqual(["pg decentralize", "pg mod", "pg deploy"]);
    });

    it("uses the `pg` prefix and a non-empty description for every entry", () => {
        for (const step of NEXT_STEPS) {
            expect(step.cmd.startsWith("pg ")).toBe(true);
            expect(step.description.length).toBeGreaterThan(0);
        }
    });

    it("contains no em dashes (house style)", () => {
        for (const step of NEXT_STEPS) {
            expect(step.cmd).not.toContain("—");
            expect(step.description).not.toContain("—");
        }
    });
});
