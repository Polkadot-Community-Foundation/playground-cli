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

import React from "react";
import { Command } from "commander";
import { render } from "ink";
import { withSpan } from "../../telemetry.js";
import { runCliCommand } from "../../cli-runtime.js";
import { getTokenSymbol } from "../../config.js";
import { DripScreen, type DripOutcome } from "./DripScreen.js";

const TOKEN = getTokenSymbol();

export const dripCommand = new Command("drip")
    .description(
        `Top up your signed-in account with a little testnet ${TOKEN} (1 ${TOKEN} at a time)`,
    )
    .action(async () =>
        runCliCommand("drip", {}, async () => {
            console.log();

            const outcome = await withSpan("cli.drip.tui", "drip tokens", async () => {
                let result: DripOutcome = "error";
                const app = render(
                    React.createElement(DripScreen, {
                        onDone: (o: DripOutcome) => {
                            result = o;
                            app.unmount();
                        },
                    }),
                );
                await app.waitUntilExit();
                return result;
            });

            console.log();

            // Only an unexpected failure is a non-zero exit. "Log in first",
            // "couldn't read your account", and "dev funder out of tokens" are
            // expected, actionable outcomes the user just read in a friendly
            // box — exiting 1 there would read as a crash and trip CI/script
            // error handling for nothing.
            if (outcome === "error") process.exitCode = 1;
        }),
    );
