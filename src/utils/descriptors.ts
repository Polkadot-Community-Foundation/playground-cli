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

import { paseo_asset_hub } from "@parity/product-sdk-descriptors/paseo-asset-hub";
import { paseo_bulletin } from "@parity/product-sdk-descriptors/paseo-bulletin";
import { paseo_individuality } from "@parity/product-sdk-descriptors/paseo-individuality";
import { summit_asset_hub } from "@parity/product-sdk-descriptors/summit-asset-hub";
import { summit_bulletin } from "@parity/product-sdk-descriptors/summit-bulletin";
import { summit_individuality } from "@parity/product-sdk-descriptors/summit-individuality";
import type { Env } from "../config.js";

export type AssetHubDescriptor = typeof paseo_asset_hub;
export type BulletinDescriptor = typeof paseo_bulletin;
export type IndividualityDescriptor = typeof paseo_individuality;

function isSummit(env: Env | undefined): boolean {
    return env === "summit";
}

/**
 * Descriptor selection follows the active product network. The return types
 * intentionally keep the existing paseo-shaped surface: the call sites use
 * common pallets only, and narrowing the whole client graph to descriptor
 * unions would force every account/status helper to carry duplicate types.
 */
export function getAssetHubDescriptor(env: Env | undefined): AssetHubDescriptor {
    return (isSummit(env) ? summit_asset_hub : paseo_asset_hub) as unknown as AssetHubDescriptor;
}

export function getBulletinDescriptor(env: Env | undefined): BulletinDescriptor {
    return (isSummit(env) ? summit_bulletin : paseo_bulletin) as unknown as BulletinDescriptor;
}

export function getIndividualityDescriptor(env: Env | undefined): IndividualityDescriptor {
    return (isSummit(env)
        ? summit_individuality
        : paseo_individuality) as unknown as IndividualityDescriptor;
}
