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

/**
 * Shown above the "set a username?" choice at the end of `playground login`,
 * so the user sees the XP incentive before deciding whether to claim a handle.
 * Rendered as a green `success` Callout (a reward, not a warning).
 */
export const USERNAME_XP_REWARD = 25;

export const USERNAME_XP_TITLE = `Earn ${USERNAME_XP_REWARD} XP`;

export const USERNAME_XP_BODY =
    `Setting a username grants you ${USERNAME_XP_REWARD} XP and claims your handle ` +
    "for your playground profile.";
