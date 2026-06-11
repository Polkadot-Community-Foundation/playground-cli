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
import { createSigningCounter, createApprovalPrompt, type SigningEvent } from "./signingProxy.js";

describe("createSigningCounter", () => {
    it("returns bare sequential step numbers with no predicted total", () => {
        // Regression: the counter used to carry a plan-derived total, and a
        // plan that over-predicted (e.g. a `setUserPopStatus` tx that runtime
        // skipped) stranded users on "step 4 of 5" with no fifth step. The
        // counter now just numbers taps as they happen.
        const c = createSigningCounter();
        expect(c.next()).toEqual({ step: 1 });
        expect(c.next()).toEqual({ step: 2 });
        expect(c.next()).toEqual({ step: 3 });
        expect(c.count()).toBe(3);
    });
});

describe("createApprovalPrompt", () => {
    it("emits sign-request on open and sign-complete on complete(), sharing the counter", () => {
        const events: SigningEvent[] = [];
        const counter = createSigningCounter();
        const prompt = createApprovalPrompt(counter, (e) => events.push(e));

        // A signing tap reserves step 1 elsewhere…
        counter.next();
        // …so the allowance tap continues the same sequence at step 2.
        const handle = prompt("Grant Bulletin storage allowance");
        handle.complete();

        expect(events).toEqual([
            { kind: "sign-request", label: "Grant Bulletin storage allowance", step: 2 },
            { kind: "sign-complete", label: "Grant Bulletin storage allowance", step: 2 },
        ]);
    });

    it("emits sign-error with the failure message on fail()", () => {
        const events: SigningEvent[] = [];
        const prompt = createApprovalPrompt(createSigningCounter(), (e) => events.push(e));

        const handle = prompt("Grant Bulletin storage allowance");
        handle.fail("declined on phone");

        expect(events).toEqual([
            { kind: "sign-request", label: "Grant Bulletin storage allowance", step: 1 },
            {
                kind: "sign-error",
                label: "Grant Bulletin storage allowance",
                step: 1,
                message: "declined on phone",
            },
        ]);
    });
});
