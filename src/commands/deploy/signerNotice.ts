// Copyright (C) Parity Technologies (UK) Ltd.
// SPDX-License-Identifier: Apache-2.0

// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0

// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

import type { SignerMode } from "../../utils/deploy/signerMode.js";
import type { SelectOption } from "../../utils/ui/theme/Select.js";

/**
 * Shown when a deploy starts without a logged-in mobile session.
 *
 * Mobile (phone) signing needs a paired session from `playground login`; without
 * it the phone path is unavailable, but a dev deploy still works out of the box.
 * The interactive picker renders this as a yellow Callout above the signer
 * options (mirroring the `playground mod` "Community Code" notice); the headless
 * `--signer phone` path surfaces the same intent as a hard error since there's
 * no TUI to fall back into.
 */
export const NO_SESSION_NOTICE_TITLE = "Mobile signing unavailable";

export const NO_SESSION_NOTICE_BODY =
    "You are not logged in, so signing with your phone is not available yet. " +
    'Run "playground login" to pair your phone, then re-run the deploy. ' +
    "You can continue now with the dev signer. Logging in also lets your deploys earn XP.";

/**
 * Shown above the signer options when phone signing IS available, so the user
 * spots the trade-off before picking the dev signer. The dev signer publishes
 * from a shared test account, so XP earned for a deploy cannot accrue to the
 * user; only signing from their own (phone) account does. Rendered as a yellow
 * Callout, alongside `SIGNER_HELP`, only on the logged-in path.
 */
export const DEV_SIGNER_NO_XP_TITLE = "Dev signer earns no XP";

export const DEV_SIGNER_NO_XP_BODY =
    "The dev signer publishes from a shared test account, so this deploy earns you no XP. " +
    "Pick your phone signer to publish from your own account and earn XP.";

/**
 * Hard-error message for an explicit `--signer phone` with no session in a
 * non-interactive (headless) deploy, where no Callout can be rendered.
 */
export const NO_SESSION_HEADLESS_ERROR =
    "Mobile (phone) signing needs a logged-in session. " +
    'Run "playground login" to pair your phone, or use "--signer dev" for a dev deploy.';

/**
 * The signer options for the interactive `playground deploy` picker. The phone
 * signer leads (and so is the default cursor position) when a session exists;
 * without one it isn't offered at all and {@link NO_SESSION_NOTICE_BODY}
 * explains how to enable it.
 */
export function deploySignerOptions(hasSession: boolean): SelectOption<SignerMode>[] {
    const phone: SelectOption<SignerMode> = {
        value: "phone",
        label: "your phone signer",
        hint: "signs with your own account",
    };
    const dev: SelectOption<SignerMode> = {
        value: "dev",
        label: "dev signer",
        hint: "fast, no phone needed",
    };
    return hasSession ? [phone, dev] : [dev];
}

/**
 * Whether to show the {@link DEV_SIGNER_NO_XP_TITLE} warning. The "no XP"
 * trade-off only matters while the dev option is highlighted AND a phone
 * alternative actually exists to switch to (i.e. the user is logged in), so the
 * warning appears as the cursor lands on the dev signer and disappears again on
 * the way back to the phone signer. Shared by `deploy` and `decentralize`.
 */
export function shouldShowDevNoXpWarning(hasSession: boolean, highlighted: SignerMode): boolean {
    return hasSession && highlighted === "dev";
}
