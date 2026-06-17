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
import { runCliCommand } from "../../cli-runtime.js";
import { runModCommand } from "../mod/index.js";

/**
 * The starter app `playground init` clones. It's a registry domain, so the same
 * resolution + setup path `playground mod <domain>` uses applies unchanged.
 */
const TEMPLATE_DOMAIN = "playground-template";

export const initCommand = new Command("init")
    .description("Start a new project from the playground starter template")
    .action(async () =>
        runCliCommand("init", { watchdog: true, hardExit: true }, () =>
            runModCommand(TEMPLATE_DOMAIN),
        ),
    );
