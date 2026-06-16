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

/** Pure decision + text helpers for SetupScreen's package-manager phase. */

import type { PackageManager } from "../../utils/packageManagers.js";

/** Phase to enter after the source has been downloaded and the PM planned. */
export type PmPhase = "setup" | "confirm" | "install";

export function decidePmPhase(opts: { missing: string[]; isTTY: boolean }): PmPhase {
    if (opts.missing.length === 0) return "setup";
    return opts.isTTY ? "confirm" : "install";
}

/** Confirmation prompt label, naming the PM and the exact tools to install. */
export function pmConfirmLabel(pm: PackageManager, toolsToInstall: string[]): string {
    return `This project uses ${pm}, which isn't installed. Install it now? (${toolsToInstall.join(" + ")})`;
}
