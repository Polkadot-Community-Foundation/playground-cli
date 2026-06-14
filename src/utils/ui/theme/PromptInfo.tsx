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

import { Text } from "ink";
import { Callout } from "./Callout.js";

/**
 * The magenta (accent) help box shown above an interactive prompt. Used by
 * `playground deploy` and `playground decentralize` to explain each choice
 * before the user makes it. `box` is structurally a `PromptBox`
 * (`{ title, body }`) — the copy lives in each command's `promptHelp.ts`.
 */
export function PromptInfo({ box }: { box: { title: string; body: string } }) {
    return (
        <Callout tone="accent" title={box.title}>
            <Text>{box.body}</Text>
        </Callout>
    );
}
