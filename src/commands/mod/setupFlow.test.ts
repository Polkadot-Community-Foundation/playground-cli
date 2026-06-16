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
import { decidePmPhase, pmConfirmLabel } from "./setupFlow.js";

describe("decidePmPhase", () => {
    it("goes straight to setup when nothing is missing", () => {
        expect(decidePmPhase({ missing: [], isTTY: true })).toBe("setup");
    });

    it("prompts for confirmation in a TTY when tools are missing", () => {
        expect(decidePmPhase({ missing: ["Node.js", "pnpm"], isTTY: true })).toBe("confirm");
    });

    it("auto-installs without a prompt when there is no TTY", () => {
        expect(decidePmPhase({ missing: ["bun"], isTTY: false })).toBe("install");
    });
});

describe("pmConfirmLabel", () => {
    it("names the PM and exactly what will be installed", () => {
        expect(pmConfirmLabel("pnpm", ["Node.js", "pnpm"])).toBe(
            "This project uses pnpm, which isn't installed. Install it now? (Node.js + pnpm)",
        );
    });
});
