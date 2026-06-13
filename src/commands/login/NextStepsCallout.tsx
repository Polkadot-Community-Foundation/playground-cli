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

import { Box, Text } from "ink";
import { Callout, COLOR } from "../../utils/ui/theme/index.js";
import { NEXT_STEPS } from "./nextSteps.js";

/**
 * Bordered "try this next" box rendered at the end of a successful login, so a
 * freshly-paired user knows what to run next. Data lives in `nextSteps.ts`;
 * this is a thin map over it.
 */
export function NextSteps() {
    return (
        <Callout tone="accent" title="Try one of these next:">
            {NEXT_STEPS.map((step) => (
                <Box key={step.cmd} flexDirection="column" marginTop={1}>
                    <Text color={COLOR.accent} bold>
                        {step.cmd}
                    </Text>
                    <Text dimColor>{`  ${step.description}`}</Text>
                </Box>
            ))}
        </Callout>
    );
}
