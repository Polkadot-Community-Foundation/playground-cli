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
 * The "edit with claude" line of the post-clone "Next steps" block. For a quest
 * track the user actually started, it nudges them toward the prepopulated AI
 * prompt that kicks off the guided tutorial; a plain mod has no such entry
 * point, so it stays generic.
 */
export function editWithClaudeStep(startedTutorial: boolean): string {
    return startedTutorial
        ? '  2. edit with claude (prompt: "start tutorial")'
        : "  2. edit with claude";
}
