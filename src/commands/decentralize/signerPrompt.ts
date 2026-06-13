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

import type { SignerMode } from "../../utils/deploy/signerMode.js";
import type { SelectOption } from "../../utils/ui/theme/Select.js";

/**
 * Signer options for the interactive `playground decentralize` picker. The
 * phone signer leads, matching `playground deploy`. Unlike deploy, the phone
 * option stays selectable without a session (its hint points the user at
 * `playground login`, and selecting it surfaces a login error), and the cursor
 * defaults to the dev signer (see {@link decentralizeSignerInitialIndex}).
 * Deploy instead renders the no-session phone option `disabled` (greyed out,
 * cursor skips it); we keep the select-to-error behaviour here because it is
 * the established decentralize UX. Both options are always present.
 */
export function decentralizeSignerOptions(hasSession: boolean): SelectOption<SignerMode>[] {
    return [
        {
            value: "phone",
            label: "your phone signer",
            hint: hasSession
                ? "signed with your logged-in account"
                : "requires `playground login` first",
        },
        {
            value: "dev",
            label: "dev signer",
            hint: "fast, signs locally with the polkadot-app-deploy default account",
        },
    ];
}

/**
 * Default cursor position for the decentralize signer picker. Because both
 * options are always shown, default to the one the user can actually use: the
 * phone signer (index 0) when logged in, otherwise the dev signer (index 1).
 * Pressing Enter on the default therefore never lands on the login error.
 */
export function decentralizeSignerInitialIndex(hasSession: boolean): number {
    return hasSession ? 0 : 1;
}
