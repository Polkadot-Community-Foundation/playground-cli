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

import { describe, it, expect } from "vitest";
import { assertTagRequiresPlayground } from "./index.js";

describe("assertTagRequiresPlayground", () => {
    it("rejects --tag without --playground", () => {
        expect(() => assertTagRequiresPlayground({ tag: "site", playground: false })).toThrow(
            /--tag requires --playground/,
        );
        expect(() => assertTagRequiresPlayground({ tag: "site" })).toThrow(
            /--tag requires --playground/,
        );
    });

    it("allows a tag when publishing to the playground", () => {
        expect(() => assertTagRequiresPlayground({ tag: "site", playground: true })).not.toThrow();
    });

    it("allows no tag regardless of the --playground flag", () => {
        expect(() => assertTagRequiresPlayground({ playground: false })).not.toThrow();
        expect(() => assertTagRequiresPlayground({ playground: true })).not.toThrow();
        expect(() => assertTagRequiresPlayground({})).not.toThrow();
    });
});
