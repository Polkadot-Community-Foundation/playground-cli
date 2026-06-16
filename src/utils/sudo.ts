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

/**
 * Privilege prefix for shell install commands. A pure leaf module on purpose:
 * shared by `toolchain.ts` (login prereqs) and `packageManagers.ts` (which must
 * stay importable from the React-free build/deploy SDK surface, so it can't pull
 * in toolchain.ts's process-spawning machinery).
 */

/** Returns "sudo " when not already running as root, empty string otherwise. */
export const sudo = (): string =>
    typeof process.getuid === "function" && process.getuid() === 0 ? "" : "sudo ";
