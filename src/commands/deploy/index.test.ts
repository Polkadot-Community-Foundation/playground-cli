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
    assertPublishFlagsConsistent,
    classifyDeployDone,
    DEFAULT_GRACEFUL_NUDGE,
    isFullySpecified,
    resolveGracefulNudge,
    shouldResolveUserSigner,
} from "./index.js";
import type { DeployOutcome } from "../../utils/deploy/run.js";

describe("shouldResolveUserSigner", () => {
    it("skips signer lookup for pure dev deploys", () => {
        expect(shouldResolveUserSigner({ mode: "dev" })).toBe(false);
    });

    it("loads the logged-in signer for dev deploys that publish to playground", () => {
        expect(shouldResolveUserSigner({ mode: "dev", publishToPlayground: true })).toBe(true);
    });

    it("loads a signer for phone mode", () => {
        expect(shouldResolveUserSigner({ mode: "phone" })).toBe(true);
    });

    it("loads a signer when a suri is supplied", () => {
        expect(shouldResolveUserSigner({ mode: "dev", suri: "//Alice" })).toBe(true);
    });
});

describe("isFullySpecified", () => {
    const fullySpecified = {
        signer: "phone",
        domain: "my-app",
        buildDir: "dist",
        playground: true,
    } as const;

    it("keeps deploy interactive when the contracts answer is omitted", () => {
        expect(isFullySpecified(fullySpecified)).toBe(false);
    });

    it("allows headless deploy when contracts are explicitly enabled", () => {
        expect(isFullySpecified({ ...fullySpecified, contracts: true })).toBe(true);
    });

    it("allows headless deploy when contracts are explicitly skipped", () => {
        expect(isFullySpecified({ ...fullySpecified, contracts: false })).toBe(true);
    });
});

describe("classifyDeployDone", () => {
    // A realistic non-null outcome — only its non-null-ness matters here.
    const outcome = { appUrl: "https://x.dot", fullDomain: "x.dot" } as DeployOutcome;

    it("treats a non-null outcome as success", () => {
        expect(classifyDeployDone(outcome)).toBe("success");
        // `graceful` is irrelevant once an outcome exists.
        expect(classifyDeployDone(outcome, { graceful: true })).toBe("success");
    });

    it("treats a graceful null cancel as graceful-cancel (exit 0)", () => {
        expect(classifyDeployDone(null, { graceful: true })).toBe("graceful-cancel");
    });

    it("treats a plain null cancel as a failure (exit 1)", () => {
        expect(classifyDeployDone(null)).toBe("failure");
        expect(classifyDeployDone(null, {})).toBe("failure");
        expect(classifyDeployDone(null, { graceful: false })).toBe("failure");
    });
});

describe("resolveGracefulNudge", () => {
    it("falls back to the README nudge when no message is supplied", () => {
        // The README-acknowledgement exit carries no cause-specific copy.
        expect(resolveGracefulNudge()).toBe(DEFAULT_GRACEFUL_NUDGE);
        expect(resolveGracefulNudge(undefined)).toBe(DEFAULT_GRACEFUL_NUDGE);
    });

    it("uses the stage-supplied message verbatim when present", () => {
        // The moddable setup menu's exit supplies its own cause-neutral nudge.
        const moddableNudge =
            "No problem. Fix the GitHub repository setup and re-run `playground deploy` when ready.";
        expect(resolveGracefulNudge(moddableNudge)).toBe(moddableNudge);
    });
});

describe("assertPublishFlagsConsistent", () => {
    it("rejects --tag without --playground", () => {
        expect(() =>
            assertPublishFlagsConsistent({
                moddable: false,
                tag: "defi",
                publishToPlayground: false,
            }),
        ).toThrow(/--tag requires --playground/);
    });

    it("rejects --moddable without --playground", () => {
        expect(() =>
            assertPublishFlagsConsistent({ moddable: true, tag: null, publishToPlayground: false }),
        ).toThrow(/--moddable requires --playground/);
    });

    it("reports the moddable conflict first when both flags are set without --playground", () => {
        expect(() =>
            assertPublishFlagsConsistent({
                moddable: true,
                tag: "defi",
                publishToPlayground: false,
            }),
        ).toThrow(/--moddable requires --playground/);
    });

    it("allows a tag when publishing to the playground", () => {
        expect(() =>
            assertPublishFlagsConsistent({
                moddable: true,
                tag: "defi",
                publishToPlayground: true,
            }),
        ).not.toThrow();
    });

    it("allows an untagged, non-moddable deploy with no --playground", () => {
        expect(() =>
            assertPublishFlagsConsistent({
                moddable: false,
                tag: null,
                publishToPlayground: false,
            }),
        ).not.toThrow();
    });
});
