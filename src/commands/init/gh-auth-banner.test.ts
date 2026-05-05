import { describe, it, expect } from "vitest";
import { formatGhAuthBanner } from "./gh-auth-banner.js";

const stripAnsi = (s: string) => s.replace(/\x1b\[[0-9;]*m/g, "");

describe("formatGhAuthBanner", () => {
    it("explains the IP-based rate limit and the gh auth fix", () => {
        const plain = stripAnsi(formatGhAuthBanner());
        expect(plain).toMatch(/60\/hour/);
        expect(plain).toMatch(/5000\/hour/);
        expect(plain).toMatch(/gh auth login/);
        expect(plain).toMatch(/public wifis/);
        expect(plain).toMatch(/GitHub authentication recommended/);
    });

    it("starts and ends with blank lines so it visually separates from prior output", () => {
        const out = formatGhAuthBanner();
        expect(out.startsWith("\n")).toBe(true);
        expect(out.endsWith("\n\n")).toBe(true);
    });

    it("renders a rounded box with aligned borders", () => {
        const plain = stripAnsi(formatGhAuthBanner());
        const lines = plain.split("\n");
        const boxLines = lines.filter((l) => l.includes("│") || l.includes("╭") || l.includes("╰"));

        // Top border, body rows, bottom border — all the same visible width.
        const widths = new Set(boxLines.map((l) => l.length));
        expect(widths.size).toBe(1);

        // Top + bottom rounded corners present exactly once each.
        expect(plain.match(/╭/g)?.length).toBe(1);
        expect(plain.match(/╮/g)?.length).toBe(1);
        expect(plain.match(/╰/g)?.length).toBe(1);
        expect(plain.match(/╯/g)?.length).toBe(1);
    });
});
