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
import { StatusScreen, type StatusOutcome } from "./StatusScreen.js";

export const statusCommand = new Command("status")
    .description("Show your signed-in product account, balances, and allowance status")
    .action(async () =>
        runCliCommand("status", {}, async () => {
            console.log();

            const outcome = await withSpan("cli.status.tui", "show status", async () => {
                let result: StatusOutcome = "error";
                const app = render(
                    React.createElement(StatusScreen, {
                        onDone: (o: StatusOutcome) => {
                            result = o;
                            app.unmount();
                        },
                    }),
                );
                await app.waitUntilExit();
                return result;
            });

            console.log();

            // "needLogin" is an expected, actionable soft outcome (the user just
            // read a friendly box); only a genuine failure exits non-zero.
            if (outcome === "error") process.exitCode = 1;
        }),
    );
