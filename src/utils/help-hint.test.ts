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

import { Command } from "commander";
import { afterEach, describe, expect, it, vi } from "vitest";
import { appendHelpHint, installHelpHint } from "./help-hint.js";

describe("appendHelpHint", () => {
    it("appends a commands hint when an unknown command has no suggestion", () => {
        const out = appendHelpHint("error: unknown command 'xyzzy'\n", "playground");
        expect(out).toBe(
            "error: unknown command 'xyzzy'\nRun 'playground --help' to see available commands.\n",
        );
    });

    it("appends an options hint when an unknown option has no suggestion", () => {
        const out = appendHelpHint("error: unknown option '--zzz'\n", "playground");
        expect(out).toBe(
            "error: unknown option '--zzz'\nRun 'playground --help' to see available options.\n",
        );
    });

    it("leaves an unknown command untouched when commander already suggested one", () => {
        const input = "error: unknown command 'loign'\n(Did you mean login?)\n";
        expect(appendHelpHint(input, "playground")).toBe(input);
    });

    it("leaves an unknown option untouched when commander already suggested one", () => {
        const input = "error: unknown option '--yse'\n(Did you mean --yes?)\n";
        expect(appendHelpHint(input, "playground")).toBe(input);
    });

    it("leaves unrelated errors untouched", () => {
        const input = "error: required option '--name <value>' not specified\n";
        expect(appendHelpHint(input, "playground")).toBe(input);
    });

    it("uses the supplied program name in the hint", () => {
        const out = appendHelpHint("error: unknown command 'nope'\n", "pg");
        expect(out).toBe(
            "error: unknown command 'nope'\nRun 'pg --help' to see available commands.\n",
        );
    });

    it("appends a trailing newline before the hint when the error text lacks one", () => {
        const out = appendHelpHint("error: unknown command 'nope'", "playground");
        expect(out).toBe(
            "error: unknown command 'nope'\nRun 'playground --help' to see available commands.\n",
        );
    });
});

describe("installHelpHint", () => {
    afterEach(() => vi.restoreAllMocks());

    function buildProgram(): Command {
        const program = new Command().name("playground").exitOverride();
        const login = new Command("login").option("--yes").exitOverride();
        // addCommand (not .command()) mirrors src/index.ts; commander does NOT
        // propagate the root output config to addCommand'd subcommands, which is
        // exactly why installHelpHint must walk the tree.
        program.addCommand(login);
        installHelpHint(program);
        return program;
    }

    function captureStderr(): { read: () => string } {
        let buf = "";
        vi.spyOn(process.stderr, "write").mockImplementation((chunk: string | Uint8Array) => {
            buf += chunk.toString();
            return true;
        });
        return { read: () => buf };
    }

    it("adds the hint to a root-level unknown command with no suggestion", () => {
        const program = buildProgram();
        const stderr = captureStderr();
        expect(() => program.parse(["xyzzy"], { from: "user" })).toThrow();
        expect(stderr.read()).toContain("Run 'playground --help' to see available commands.");
    });

    it("adds the hint to a SUBCOMMAND unknown option with no suggestion", () => {
        const program = buildProgram();
        const stderr = captureStderr();
        expect(() => program.parse(["login", "--zzzzzz"], { from: "user" })).toThrow();
        expect(stderr.read()).toContain("Run 'playground --help' to see available options.");
    });

    it("does not add the hint when the subcommand option has a suggestion", () => {
        const program = buildProgram();
        const stderr = captureStderr();
        expect(() => program.parse(["login", "--yse"], { from: "user" })).toThrow();
        expect(stderr.read()).toContain("Did you mean --yes?");
        expect(stderr.read()).not.toContain("--help");
    });
});
