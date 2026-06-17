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

// Direct coverage of the env → descriptor selectors. The consumer tests
// (connection / registry / bulletinAuthContext) only exercise whichever env is
// the active `DEFAULT_ENV`, so when the network switch is on paseo the summit
// arms here would otherwise never run. These cases assert BOTH branches
// explicitly, independent of `ACTIVE_TESTNET_ENV`, so the summit selection is
// genuinely tested today and the one-line switch stays a no-surprise flip.

import { describe, expect, it, vi } from "vitest";

// Identity-tagged stand-ins so the assertions can prove WHICH descriptor object
// each selector returns without importing the real (heavy) descriptors.
vi.mock("@parity/product-sdk-descriptors/paseo-asset-hub", () => ({
    paseo_asset_hub: { genesis: "0xpaseo-asset" },
}));
vi.mock("@parity/product-sdk-descriptors/paseo-bulletin", () => ({
    paseo_bulletin: { genesis: "0xpaseo-bulletin" },
}));
vi.mock("@parity/product-sdk-descriptors/paseo-individuality", () => ({
    paseo_individuality: { genesis: "0xpaseo-people" },
}));
vi.mock("@parity/product-sdk-descriptors/summit-asset-hub", () => ({
    summit_asset_hub: { genesis: "0xsummit-asset" },
}));
vi.mock("@parity/product-sdk-descriptors/summit-bulletin", () => ({
    summit_bulletin: { genesis: "0xsummit-bulletin" },
}));
vi.mock("@parity/product-sdk-descriptors/summit-individuality", () => ({
    summit_individuality: { genesis: "0xsummit-people" },
}));

import { paseo_asset_hub } from "@parity/product-sdk-descriptors/paseo-asset-hub";
import { paseo_bulletin } from "@parity/product-sdk-descriptors/paseo-bulletin";
import { paseo_individuality } from "@parity/product-sdk-descriptors/paseo-individuality";
import { summit_asset_hub } from "@parity/product-sdk-descriptors/summit-asset-hub";
import { summit_bulletin } from "@parity/product-sdk-descriptors/summit-bulletin";
import { summit_individuality } from "@parity/product-sdk-descriptors/summit-individuality";
import {
    getAssetHubDescriptor,
    getBulletinDescriptor,
    getIndividualityDescriptor,
} from "./descriptors.js";

describe("getAssetHubDescriptor", () => {
    it("returns the summit descriptor for summit", () => {
        expect(getAssetHubDescriptor("summit")).toBe(summit_asset_hub);
    });

    it("returns the paseo descriptor for paseo-next-v2", () => {
        expect(getAssetHubDescriptor("paseo-next-v2")).toBe(paseo_asset_hub);
    });

    it("falls back to paseo for any non-summit env (summit is the only divergent one)", () => {
        expect(getAssetHubDescriptor("polkadot")).toBe(paseo_asset_hub);
        expect(getAssetHubDescriptor(undefined)).toBe(paseo_asset_hub);
    });
});

describe("getBulletinDescriptor", () => {
    it("returns the summit descriptor for summit", () => {
        expect(getBulletinDescriptor("summit")).toBe(summit_bulletin);
    });

    it("returns the paseo descriptor otherwise", () => {
        expect(getBulletinDescriptor("paseo-next-v2")).toBe(paseo_bulletin);
        expect(getBulletinDescriptor(undefined)).toBe(paseo_bulletin);
    });
});

describe("getIndividualityDescriptor", () => {
    it("returns the summit descriptor for summit", () => {
        expect(getIndividualityDescriptor("summit")).toBe(summit_individuality);
    });

    it("returns the paseo descriptor otherwise", () => {
        expect(getIndividualityDescriptor("paseo-next-v2")).toBe(paseo_individuality);
        expect(getIndividualityDescriptor(undefined)).toBe(paseo_individuality);
    });
});
