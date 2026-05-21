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

export interface PhoneApprovalCalloutProps {
    step: number;
    total: number;
    label: string;
}

export function PhoneApprovalCallout({ step, total, label }: PhoneApprovalCalloutProps) {
    return (
        <Callout tone="warning" title="check your phone">
            <Text>
                approve step {step} of {total}: <Text bold>{label}</Text>
            </Text>
        </Callout>
    );
}
