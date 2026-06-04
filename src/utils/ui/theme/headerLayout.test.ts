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
import { layoutHeader, RIGHT_GAP_MIN } from "./headerLayout.js";

/** Total columns the left breadcrumb occupies once joined with `separator`. */
function leftWidth(layout: ReturnType<typeof layoutHeader>): number {
    return layout.pieces.join(layout.separator).length;
}

describe("layoutHeader", () => {
    it("keeps the wide separator when everything fits", () => {
        const layout = layoutHeader(
            { cmd: "playground deploy", subtitle: "myapp.dot", network: "paseo next v2" },
            "v0.28.5",
            72,
        );
        expect(layout.separator).toBe("  ·  ");
        expect(layout.pieces).toEqual(["playground deploy", "myapp.dot", "paseo next v2"]);
    });

    // Regression: the exact overflow from the field. Row cap 72 minus the
    // 2-col left padding = 70 effective, long domain. Yoga used to shrink
    // every Text node, rendering
    // "playground deplo  ·  devsignerutkplayground.do  · paseo next v2v0.28.5"
    // (clipped cmd, domain missing the final "t" of ".dot", version glued to
    // the network label). Narrowing the separator + gap must fit it losslessly.
    it("narrows the separator instead of clipping pieces (field repro)", () => {
        const layout = layoutHeader(
            {
                cmd: "playground deploy",
                subtitle: "devsignerutkplayground.dot",
                network: "paseo next v2",
            },
            "v0.28.5",
            70,
        );
        expect(layout.pieces).toEqual([
            "playground deploy",
            "devsignerutkplayground.dot",
            "paseo next v2",
        ]);
        expect(layout.separator).toBe(" · ");
        // The version label must keep at least the tight gap.
        expect(leftWidth(layout)).toBeLessThanOrEqual(70 - "v0.28.5".length - RIGHT_GAP_MIN);
    });

    it("middle-truncates the subtitle so the .dot suffix survives", () => {
        const layout = layoutHeader(
            {
                cmd: "playground deploy",
                subtitle: "a-very-long-domain-name-indeed-yes.dot",
                network: "paseo next v2",
            },
            "v0.28.5",
            60,
        );
        const [cmd, subtitle, network] = layout.pieces;
        expect(cmd).toBe("playground deploy");
        expect(network).toBe("paseo next v2");
        expect(subtitle).toContain("…");
        expect(subtitle?.endsWith(".dot")).toBe(true);
        expect(leftWidth(layout)).toBeLessThanOrEqual(60 - "v0.28.5".length - RIGHT_GAP_MIN);
    });

    it("sacrifices the username before the subtitle", () => {
        const layout = layoutHeader(
            {
                cmd: "playground deploy",
                subtitle: "myapp.dot",
                network: "paseo next v2",
                username: "a-thirty-character-username-xx",
            },
            "v0.28.5",
            72,
        );
        const [, subtitle, , username] = layout.pieces;
        expect(subtitle).toBe("myapp.dot");
        expect(username).toContain("…");
        expect(leftWidth(layout)).toBeLessThanOrEqual(72 - "v0.28.5".length - RIGHT_GAP_MIN);
    });

    it("uses the full width when there is no right label", () => {
        const layout = layoutHeader(
            {
                cmd: "playground deploy",
                subtitle: "devsignerutkplayground.dot",
                network: "paseo next v2",
            },
            undefined,
            72,
        );
        // 66 cols of content fits in 72 without any squeeze.
        expect(layout.separator).toBe("  ·  ");
        expect(layout.pieces[1]).toBe("devsignerutkplayground.dot");
    });

    it("keeps the gap even when both username and subtitle hit the floor", () => {
        const layout = layoutHeader(
            {
                cmd: "playground deploy",
                subtitle: "a-very-long-domain-name-indeed-yes.dot",
                network: "paseo next v2",
                username: "a-thirty-character-username-xx",
            },
            "v0.28.5",
            70,
        );
        // Previously the MIN_PIECE floor left 1 col of overflow and yoga glued
        // the version onto the username. The below-floor pass must absorb it.
        expect(leftWidth(layout)).toBeLessThanOrEqual(70 - "v0.28.5".length - RIGHT_GAP_MIN);
        expect(layout.pieces[0]).toBe("playground deploy");
        expect(layout.pieces[2]).toBe("paseo next v2");
    });

    it("truncates below the floor before clipping cmd (56-col terminal)", () => {
        const layout = layoutHeader(
            {
                cmd: "playground deploy",
                subtitle: "devsignerutkplayground.dot",
                network: "paseo next v2",
            },
            "v0.28.5",
            54,
        );
        expect(layout.pieces[0]).toBe("playground deploy");
        expect(layout.pieces[1]?.endsWith(".dot")).toBe(true);
        expect(leftWidth(layout)).toBeLessThanOrEqual(54 - "v0.28.5".length - RIGHT_GAP_MIN);
    });

    it("never truncates cmd, even at hopeless widths", () => {
        const layout = layoutHeader(
            { cmd: "playground deploy", subtitle: "some-domain.dot", network: "paseo next v2" },
            "v0.28.5",
            30,
        );
        expect(layout.pieces[0]).toBe("playground deploy");
    });
});
