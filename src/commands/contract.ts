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

import { spawn } from "node:child_process";
import { Command } from "commander";
import { runCliCommand } from "../cli-runtime.js";

type CdmSubcommand = "deploy" | "install";

export function cdmPassthroughArgs(argv: string[], subcommand: CdmSubcommand): string[] {
    const contractIndex = argv.indexOf("contract");
    const startAt = contractIndex === -1 ? 0 : contractIndex + 1;
    const subcommandIndex = argv.indexOf(subcommand, startAt);
    return subcommandIndex === -1 ? [] : argv.slice(subcommandIndex + 1);
}

async function runCdmSubprocess(subcommand: CdmSubcommand, args: string[]): Promise<void> {
    await new Promise<void>((resolve, reject) => {
        const child = spawn("cdm", [subcommand, ...args], {
            stdio: "inherit",
            env: process.env,
        });

        child.on("error", (err: NodeJS.ErrnoException) => {
            if (err.code === "ENOENT") {
                reject(new Error('cdm is not installed. Run "dot init" or install CDM manually.'));
                return;
            }
            reject(err);
        });

        child.on("close", (code, signal) => {
            if (signal) {
                process.exitCode = signal === "SIGINT" ? 130 : 1;
                resolve();
                return;
            }
            process.exitCode = code ?? 1;
            resolve();
        });
    });
}

function makeCdmSubcommand(subcommand: CdmSubcommand): Command {
    return new Command(subcommand)
        .description(`Run cdm ${subcommand}`)
        .helpOption(false)
        .allowUnknownOption(true)
        .allowExcessArguments(true)
        .argument("[args...]", `arguments passed to cdm ${subcommand}`)
        .action(async () =>
            runCliCommand("contract", { watchdog: true, hardExit: true }, () =>
                runCdmSubprocess(subcommand, cdmPassthroughArgs(process.argv, subcommand)),
            ),
        );
}

export const contractCommand = new Command("contract")
    .description("Run CDM contract workflows")
    .addCommand(makeCdmSubcommand("deploy"))
    .addCommand(makeCdmSubcommand("install"));
