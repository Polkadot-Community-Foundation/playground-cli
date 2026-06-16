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

const MANAGERS: Array<{ bin: string; re: RegExp }> = [
    { bin: "npm", re: /(?:^|[\s;&|(])(?:npx|npm)(?:[\s;&|)]|$)/m },
    { bin: "pnpm", re: /(?:^|[\s;&|(])(?:pnpx|pnpm)(?:[\s;&|)]|$)/m },
    { bin: "bun", re: /(?:^|[\s;&|(])(?:bunx|bun)(?:[\s;&|)]|$)/m },
    // yarn has no `x`-suffixed runner — it uses `yarn dlx` / `yarnpkg`. Kept in
    // sync with the package managers `src/utils/build/detect.ts` understands.
    { bin: "yarn", re: /(?:^|[\s;&|(])(?:yarnpkg|yarn)(?:[\s;&|)]|$)/m },
];

function stripCommentsAndStrings(script: string): string {
    return script
        .split("\n")
        .map((line) => line.replace(/(^|\s)#.*$/, "$1"))
        .join("\n")
        .replace(/"[^"\n]*"/g, '""')
        .replace(/'[^'\n]*'/g, "''");
}

/**
 * Package managers the script invokes as commands (npm/npx, pnpm/pnpx,
 * bun/bunx, yarn/yarnpkg). Consumed by `src/utils/packageManagers.ts` as the
 * lowest-precedence detection signal when there's no `packageManager` field or
 * lockfile.
 */
export function detectReferencedPackageManagers(script: string): string[] {
    const code = stripCommentsAndStrings(script);
    return MANAGERS.filter((m) => m.re.test(code)).map((m) => m.bin);
}
