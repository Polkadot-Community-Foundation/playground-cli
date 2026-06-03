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
 * Community-code notice shown before a mod touches the user's machine.
 *
 * `playground mod` downloads a publisher-controlled repo and executes its
 * `setup.sh`, so both entry points surface the same light disclaimer first:
 * the interactive picker renders it above the app list, and the direct
 * `playground mod <domain>` path renders it on the setup screen. The wording
 * follows the marketplace-standard pair (unreviewed community content + use
 * at your own risk) without license-text legalese.
 */
export const COMMUNITY_NOTICE_TITLE = "Community Code";

export const COMMUNITY_NOTICE_BODY =
    "Apps here are open source, published by the community, and not reviewed. " +
    "Modding downloads the source and runs its setup script on your machine. " +
    "Review anything you don't trust first and use at your own risk.";
