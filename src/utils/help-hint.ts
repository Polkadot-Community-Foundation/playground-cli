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

import type { Command } from "commander";

/**
 * Commander v12 already prints a Levenshtein "Did you mean …?" suggestion for an
 * unknown command or option (`showSuggestionAfterError`, on by default). But when
 * the typo is too far from any real name it can't suggest anything and emits a
 * bare `error: unknown command 'xyzzy'` with no next step. `git` always tails its
 * equivalent error with `See 'git --help'`; this mirrors that.
 *
 * Wired via `installHelpHint(program)` in `src/index.ts`. We append a help
 * pointer ONLY for unknown command/option errors that commander left without a
 * suggestion; every other error (already-suggested, missing-required-option,
 * invalid-argument, …) passes through untouched.
 */
export function appendHelpHint(errorText: string, programName: string): string {
    if (errorText.includes("Did you mean")) return errorText;

    const noun = errorText.includes("unknown command")
        ? "commands"
        : errorText.includes("unknown option")
          ? "options"
          : null;
    if (noun === null) return errorText;

    const base = errorText.endsWith("\n") ? errorText : `${errorText}\n`;
    return `${base}Run '${programName} --help' to see available ${noun}.\n`;
}

/**
 * Install the help-hint output wrapper on `program` AND every descendant
 * command. Commander does NOT propagate a parent's `configureOutput` to
 * subcommands attached via `addCommand` (the form `src/index.ts` uses), so a
 * root-only hook would miss option typos on `login`, `deploy`, etc. — we walk
 * the tree so every command's error output is wrapped. The hint always points at
 * the root program name (`playground`), matching git's single generic pointer.
 */
export function installHelpHint(program: Command): void {
    const wrap = (cmd: Command): void => {
        cmd.configureOutput({
            outputError: (str, write) => write(appendHelpHint(str, program.name())),
        });
        for (const child of cmd.commands) wrap(child);
    };
    wrap(program);
}
