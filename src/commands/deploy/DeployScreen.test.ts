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
import { pickNextStage } from "./DeployScreen.js";

describe("pickNextStage", () => {
    it("continues past moddable preflight to the tag prompt once a repository URL is resolved", () => {
        expect(
            pickNextStage(
                false,
                "phone",
                true,
                "dist",
                "tw33d3r.dot",
                true,
                true,
                "git@github.com:charlesHetterich/tw33d3r",
                undefined,
            ),
        ).toEqual({ kind: "prompt-tags" });
    });

    it("reaches confirm once a tag choice (or skip) is resolved", () => {
        // A resolved tag (a string OR an explicit null "skip") clears the last
        // publish-only prompt.
        expect(
            pickNextStage(
                false,
                "phone",
                true,
                "dist",
                "tw33d3r.dot",
                true,
                true,
                "git@github.com:charlesHetterich/tw33d3r",
                "social",
            ),
        ).toEqual({ kind: "confirm" });
        expect(
            pickNextStage(
                false,
                "phone",
                true,
                "dist",
                "tw33d3r.dot",
                true,
                true,
                "git@github.com:charlesHetterich/tw33d3r",
                null,
            ),
        ).toEqual({ kind: "confirm" });
    });

    it("asks for a tag after the moddable decision when publishing", () => {
        // moddable resolved to false, no repo URL needed; the tag is still
        // unset, so the picker must run before confirm.
        expect(
            pickNextStage(
                false,
                "phone",
                true,
                "dist",
                "tw33d3r.dot",
                true,
                false,
                null,
                undefined,
            ),
        ).toEqual({ kind: "prompt-tags" });
    });

    it("never asks for a tag when not publishing to the playground", () => {
        expect(
            pickNextStage(
                false,
                "phone",
                true,
                "dist",
                "tw33d3r.dot",
                false,
                false,
                null,
                undefined,
            ),
        ).toEqual({ kind: "confirm" });
    });

    it("enters moddable preflight when moddable is true and no repository URL is resolved yet", () => {
        expect(
            pickNextStage(false, "phone", true, "dist", "tw33d3r.dot", true, true, null, undefined),
        ).toEqual({ kind: "moddable-preflight" });
    });

    it("asks whether contracts changed before the frontend build choice", () => {
        expect(pickNextStage(null, null, null, null, null, null, null, null, undefined)).toEqual({
            kind: "prompt-contracts",
        });
    });

    it("skips the frontend build prompt when contracts will be deployed", () => {
        expect(pickNextStage(null, null, true, null, null, null, null, null, undefined)).toEqual({
            kind: "prompt-signer",
        });
    });
});
