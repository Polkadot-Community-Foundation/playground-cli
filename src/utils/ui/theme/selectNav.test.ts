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
import { firstEnabledIndex, nextEnabledIndex } from "./selectNav.js";

// Mirrors the deploy signer picker: phone disabled (logged out), dev enabled.
const PHONE_DISABLED = [{ disabled: true }, {}];
const ALL_ENABLED = [{}, {}, {}];
const MIDDLE_DISABLED = [{}, { disabled: true }, {}];
const TAIL_DISABLED = [{}, { disabled: true }, { disabled: true }];

describe("firstEnabledIndex", () => {
    it("returns the start index when it is enabled", () => {
        expect(firstEnabledIndex(ALL_ENABLED, 0)).toBe(0);
        expect(firstEnabledIndex(ALL_ENABLED, 2)).toBe(2);
    });

    it("skips a disabled start to the next enabled option (deploy logged-out case)", () => {
        // The deploy picker passes initialIndex 0 with phone disabled; the
        // cursor must land on the dev signer at index 1.
        expect(firstEnabledIndex(PHONE_DISABLED, 0)).toBe(1);
    });

    it("wraps past a disabled tail back to an enabled head", () => {
        expect(firstEnabledIndex(TAIL_DISABLED, 1)).toBe(0);
        expect(firstEnabledIndex(TAIL_DISABLED, 2)).toBe(0);
    });

    it("falls back to start when every option is disabled", () => {
        expect(firstEnabledIndex([{ disabled: true }, { disabled: true }], 1)).toBe(1);
    });

    it("returns the only index for a single-option list", () => {
        expect(firstEnabledIndex([{}], 0)).toBe(0);
        expect(firstEnabledIndex([{ disabled: true }], 0)).toBe(0);
    });
});

describe("nextEnabledIndex", () => {
    it("moves to the adjacent enabled option in each direction", () => {
        expect(nextEnabledIndex(ALL_ENABLED, 0, 1)).toBe(1);
        expect(nextEnabledIndex(ALL_ENABLED, 1, -1)).toBe(0);
    });

    it("wraps around the ends", () => {
        expect(nextEnabledIndex(ALL_ENABLED, 2, 1)).toBe(0);
        expect(nextEnabledIndex(ALL_ENABLED, 0, -1)).toBe(2);
    });

    it("skips over a disabled option in both directions", () => {
        // index 1 is disabled, so forward from 0 lands on 2, backward from 2 lands on 0.
        expect(nextEnabledIndex(MIDDLE_DISABLED, 0, 1)).toBe(2);
        expect(nextEnabledIndex(MIDDLE_DISABLED, 2, -1)).toBe(0);
    });

    it("never lands on the disabled phone option (deploy logged-out case)", () => {
        // Starting on dev (index 1), both directions wrap back to dev, never phone (0).
        expect(nextEnabledIndex(PHONE_DISABLED, 1, 1)).toBe(1);
        expect(nextEnabledIndex(PHONE_DISABLED, 1, -1)).toBe(1);
    });

    it("stays put when every other option is disabled", () => {
        expect(nextEnabledIndex(TAIL_DISABLED, 0, 1)).toBe(0);
        expect(nextEnabledIndex(TAIL_DISABLED, 0, -1)).toBe(0);
    });

    it("stays put for a single-option list", () => {
        expect(nextEnabledIndex([{}], 0, 1)).toBe(0);
        expect(nextEnabledIndex([{}], 0, -1)).toBe(0);
    });
});
