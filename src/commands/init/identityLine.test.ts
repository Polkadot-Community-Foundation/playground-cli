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

import { describe, expect, it } from "vitest";
import { ss58Encode } from "@parity/product-sdk-address";
import { productAccountAddresses, productAccountDisplay } from "./identityLine.js";

// A deterministic, all-zero root public key gives a stable derived product
// account. The exact bytes don't matter; we only assert that the helper
// produces a non-empty SS58 + valid 0x-prefixed H160 and that the display
// helper renders both in the expected "ss58 (h160)" shape.
const ZERO_ROOT_SS58 = ss58Encode(new Uint8Array(32));

describe("productAccountAddresses", () => {
    it("derives a non-empty SS58 + a 42-char H160 from a root SS58", () => {
        const { ss58, h160 } = productAccountAddresses(ZERO_ROOT_SS58);
        expect(typeof ss58).toBe("string");
        expect(ss58.length).toBeGreaterThan(40);
        expect(h160).toMatch(/^0x[0-9a-fA-F]{40}$/);
    });

    it("is deterministic for the same root SS58", () => {
        const a = productAccountAddresses(ZERO_ROOT_SS58);
        const b = productAccountAddresses(ZERO_ROOT_SS58);
        expect(a.ss58).toBe(b.ss58);
        expect(a.h160).toBe(b.h160);
    });
});

describe("productAccountDisplay", () => {
    it("renders 'ss58 (h160)' with both addresses truncated", () => {
        const display = productAccountDisplay(ZERO_ROOT_SS58);
        expect(display).toMatch(/^.+\.\.\..+ \(0x.+\.\.\..+\)$/);
    });
});
