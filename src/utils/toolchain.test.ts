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

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { hasCargoPvmContract, prependPath, TOOL_STEPS } from "./toolchain.js";

describe("prependPath", () => {
    let originalPath: string | undefined;

    beforeEach(() => {
        originalPath = process.env.PATH;
    });

    afterEach(() => {
        if (originalPath === undefined) delete process.env.PATH;
        else process.env.PATH = originalPath;
    });

    it("prepends the directory when not already present", () => {
        process.env.PATH = "/usr/bin:/bin";
        prependPath("/Users/me/.cargo/bin");
        expect(process.env.PATH).toBe("/Users/me/.cargo/bin:/usr/bin:/bin");
    });

    it("is a no-op when the directory is already on PATH", () => {
        process.env.PATH = "/Users/me/.cargo/bin:/usr/bin";
        prependPath("/Users/me/.cargo/bin");
        expect(process.env.PATH).toBe("/Users/me/.cargo/bin:/usr/bin");
    });

    it("handles an empty PATH", () => {
        process.env.PATH = "";
        prependPath("/Users/me/.cargo/bin");
        expect(process.env.PATH).toBe("/Users/me/.cargo/bin");
    });

    it("handles an unset PATH", () => {
        delete process.env.PATH;
        prependPath("/Users/me/.cargo/bin");
        expect(process.env.PATH).toBe("/Users/me/.cargo/bin");
    });
});

describe("TOOL_STEPS", () => {
    it("installs git before any step whose installer shells out to it (#247)", () => {
        // On a clean Ubuntu install (no Xcode CLT equivalent), git is absent
        // until our own git step runs. Any earlier step that invokes git in
        // its install command fails — the DevEx audit hit exactly this with
        // cargo-pvm-contract's `git clone`. macOS masks the bug because git
        // is always present, so this ordering is pinned by test instead.
        const names = TOOL_STEPS.map((step) => step.name);
        const gitIndex = names.indexOf("git");
        expect(gitIndex).toBeGreaterThanOrEqual(0);

        const cargoPvmIndex = names.indexOf("cargo-pvm-contract");
        expect(cargoPvmIndex).toBeGreaterThanOrEqual(0);
        expect(gitIndex).toBeLessThan(cargoPvmIndex);
    });

    it("installs curl before any step whose installer fetches with it (#248)", () => {
        // Bare Ubuntu ships no curl. The rustup and IPFS install commands
        // both pipe from curl, so the curl step must run first. macOS masks
        // this because curl ships with the OS.
        const names = TOOL_STEPS.map((step) => step.name);
        const curlIndex = names.indexOf("curl");
        expect(curlIndex).toBeGreaterThanOrEqual(0);

        const rustupIndex = names.indexOf("rustup");
        expect(rustupIndex).toBeGreaterThanOrEqual(0);
        expect(curlIndex).toBeLessThan(rustupIndex);

        const ipfsIndex = names.indexOf("IPFS");
        expect(ipfsIndex).toBeGreaterThanOrEqual(0);
        expect(curlIndex).toBeLessThan(ipfsIndex);
    });

    it("installs the C linker before cargo-pvm-contract, which compiles (#248)", () => {
        // `cargo install` needs a system linker; bare Ubuntu has no cc until
        // build-essential lands. macOS masks this via Xcode CLT, so the
        // ordering is pinned by test, same as git in #247.
        const names = TOOL_STEPS.map((step) => step.name);
        const ccIndex = names.indexOf("C linker (cc)");
        expect(ccIndex).toBeGreaterThanOrEqual(0);

        const cargoPvmIndex = names.indexOf("cargo-pvm-contract");
        expect(cargoPvmIndex).toBeGreaterThanOrEqual(0);
        expect(ccIndex).toBeLessThan(cargoPvmIndex);
    });

    it("installs cargo-pvm-contract directly instead of the CDM CLI installer", () => {
        const names = TOOL_STEPS.map((step) => step.name);
        expect(names).toContain("cargo-pvm-contract");
        expect(names).not.toContain("cdm & cargo-pvm-contract");

        const step = TOOL_STEPS.find((entry) => entry.name === "cargo-pvm-contract");
        expect(step?.manualHint).toContain("cargo-pvm-contract");
        expect(step?.manualHint).not.toContain("contract-dependency-manager");
    });

    it("validates cargo-pvm-contract by probing the build subcommand", () => {
        const cargoStep = TOOL_STEPS.find((entry) => entry.name === "cargo-pvm-contract");
        expect(cargoStep?.check).toBe(hasCargoPvmContract);
    });
});
