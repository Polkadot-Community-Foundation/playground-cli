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

import { commandExists } from "../toolchain.js";

const MANAGERS: Array<{ bin: string; re: RegExp }> = [
    { bin: "npm", re: /(?:^|[\s;&|(])(?:npx|npm)(?:[\s;&|)]|$)/m },
    { bin: "pnpm", re: /(?:^|[\s;&|(])(?:pnpx|pnpm)(?:[\s;&|)]|$)/m },
    { bin: "bun", re: /(?:^|[\s;&|(])(?:bunx|bun)(?:[\s;&|)]|$)/m },
];

function stripCommentsAndStrings(script: string): string {
    return script
        .split("\n")
        .map((line) => line.replace(/(^|\s)#.*$/, "$1"))
        .join("\n")
        .replace(/"[^"\n]*"/g, '""')
        .replace(/'[^'\n]*'/g, "''");
}

/** Package managers the script invokes as commands (npm/npx, pnpm/pnpx, bun/bunx). */
export function detectReferencedPackageManagers(script: string): string[] {
    const code = stripCommentsAndStrings(script);
    return MANAGERS.filter((m) => m.re.test(code)).map((m) => m.bin);
}

/**
 * A `setup.sh` may reference several package managers in a fallback chain
 * (`command -v bun || ... || npm`) yet only need ONE of them. So this returns
 * the referenced managers ONLY when none of them are installed — the genuine
 * "can't run setup at all" case. An empty array means setup can proceed.
 */
export async function findUnsatisfiedPackageManagers(script: string): Promise<string[]> {
    const referenced = detectReferencedPackageManagers(script);
    if (referenced.length === 0) return [];
    for (const bin of referenced) {
        if (await commandExists(bin)) return [];
    }
    return referenced;
}

export function missingPackageManagerMessage(referenced: string[]): string {
    const list = referenced.join(", ");
    const phrase = referenced.length > 1 ? `one of: ${list}` : list;
    const hint = referenced.includes("npm")
        ? "Install Node.js (which includes npm): https://nodejs.org"
        : `Install ${referenced.join(" / ")} and try again`;
    return `setup.sh needs ${phrase}, but none is installed. ${hint}`;
}
