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
    chooseDeployDispatch,
    classifyDeployDone,
    DEFAULT_GRACEFUL_NUDGE,
    isFullySpecified,
    NON_TTY_INTERACTIVE_ERROR,
    resolveGracefulNudge,
    resolveYesDeployOpts,
    shouldResolveUserSigner,
} from "./index.js";
import { DEFAULT_BUILD_DIR } from "../../config.js";
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

describe("resolveYesDeployOpts", () => {
    it("requires a domain (--yes is non-interactive, the TUI prompt can't run)", () => {
        expect(() => resolveYesDeployOpts({})).toThrow(/--domain/);
    });

    it("rejects a blank/whitespace domain", () => {
        expect(() => resolveYesDeployOpts({ domain: "   " })).toThrow(/--domain/);
    });

    it("defaults the signer to dev when omitted", () => {
        expect(resolveYesDeployOpts({ domain: "my-app" }).signer).toBe("dev");
    });

    it("preserves an explicit signer", () => {
        expect(resolveYesDeployOpts({ domain: "my-app", signer: "phone" }).signer).toBe("phone");
    });

    it("defaults the build directory when omitted", () => {
        expect(resolveYesDeployOpts({ domain: "my-app" }).buildDir).toBe(DEFAULT_BUILD_DIR);
    });

    it("preserves an explicit build directory", () => {
        expect(resolveYesDeployOpts({ domain: "my-app", buildDir: "out" }).buildDir).toBe("out");
    });

    it("passes the domain through and leaves other flags untouched", () => {
        const resolved = resolveYesDeployOpts({
            domain: "my-app",
            playground: true,
            private: true,
        });
        expect(resolved.domain).toBe("my-app");
        expect(resolved.playground).toBe(true);
        expect(resolved.private).toBe(true);
    });
});

describe("chooseDeployDispatch", () => {
    const interactiveOpts = { signer: "phone", domain: "my-app" } as const; // not fully specified

    it("runs headless when --yes is set, even without a TTY (the P0 escape hatch)", () => {
        expect(chooseDeployDispatch({ ...interactiveOpts, yes: true }, false)).toBe("headless");
    });

    it("runs headless when --yes is set in a TTY (no TUI)", () => {
        expect(chooseDeployDispatch({ ...interactiveOpts, yes: true }, true)).toBe("headless");
    });

    it("runs headless when fully specified without --yes", () => {
        const full = {
            signer: "phone",
            domain: "my-app",
            buildDir: "dist",
            playground: true,
            contracts: false,
        } as const;
        expect(chooseDeployDispatch(full, true)).toBe("headless");
    });

    it("renders the interactive TUI when underspecified in a TTY", () => {
        expect(chooseDeployDispatch(interactiveOpts, true)).toBe("interactive");
    });

    it("errors (never renders the TUI) when underspecified without a TTY", () => {
        // This is the P0 guard: a non-TTY interactive deploy must not reach Ink.
        expect(chooseDeployDispatch(interactiveOpts, false)).toBe("non-tty-error");
    });
});

describe("NON_TTY_INTERACTIVE_ERROR", () => {
    it("tells the user how to run non-interactively", () => {
        // The P0: this message must replace the opaque Ink "Raw mode is not
        // supported" crash. It has to name --yes and --domain so an agent/CI
        // caller knows the escape hatch.
        expect(NON_TTY_INTERACTIVE_ERROR).toMatch(/--yes/);
        expect(NON_TTY_INTERACTIVE_ERROR).toMatch(/--domain/);
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
                tag: "site",
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
                tag: "site",
                publishToPlayground: false,
            }),
        ).toThrow(/--moddable requires --playground/);
    });

    it("allows a tag when publishing to the playground", () => {
        expect(() =>
            assertPublishFlagsConsistent({
                moddable: true,
                tag: "site",
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
