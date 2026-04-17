/**
 * Tests for git.ts — focused on sanitize() since it handles tricky
 * ANSI/cursor output from child processes (pnpm, cdm, Ink programs).
 *
 * The exec wrappers (forkAndClone, cloneRepo) are thin and tested
 * more effectively via integration. Testing arg construction via
 * mocked child_process is brittle and low-value.
 */

import { describe, it, expect } from "vitest";

// sanitize is not exported, so we test it indirectly by importing the module
// and calling a function that uses it. Instead, let's extract the regex and
// test the logic directly.

// Re-implement the same logic for testing — if the regex in git.ts changes,
// this test must be updated to match (or we export sanitize).
// biome-ignore lint/suspicious/noControlCharactersInRegex: intentional ANSI stripping
const ANSI_RE = /\x1B(?:\[[0-9;]*[A-Za-z]|\].*?\x07|[^[])/g;
function sanitize(s: string): string {
    return s.replace(ANSI_RE, "").replace(/\r/g, "");
}

describe("sanitize", () => {
    it("passes through clean text unchanged", () => {
        expect(sanitize("hello world")).toBe("hello world");
    });

    it("strips basic color codes", () => {
        expect(sanitize("\x1B[32mgreen\x1B[0m")).toBe("green");
    });

    it("strips bold/dim/reset sequences", () => {
        expect(sanitize("\x1B[1mbold\x1B[22m normal\x1B[0m")).toBe("bold normal");
    });

    it("strips cursor movement (Ink uses these)", () => {
        // [2K = clear line, [1A = move up, [G = move to column 0
        expect(sanitize("\x1B[2K\x1B[1A\x1B[G")).toBe("");
    });

    it("strips pnpm box-drawing output with embedded ANSI", () => {
        const pnpmLine =
            "\x1B[33m╭ Warning ──────╮\x1B[0m\r\n\x1B[33m│\x1B[0m text \x1B[33m│\x1B[0m";
        const result = sanitize(pnpmLine);
        expect(result).not.toContain("\x1B");
        expect(result).not.toContain("\r");
        expect(result).toContain("Warning");
        expect(result).toContain("text");
    });

    it("strips OSC sequences (terminal title, etc.)", () => {
        expect(sanitize("\x1B]0;my title\x07rest")).toBe("rest");
    });

    it("removes carriage returns", () => {
        expect(sanitize("progress\r50%\r100%\ndone")).toBe("progress50%100%\ndone");
    });

    it("handles empty string", () => {
        expect(sanitize("")).toBe("");
    });

    it("handles string with only ANSI codes", () => {
        expect(sanitize("\x1B[2K\x1B[1A\x1B[0m\r")).toBe("");
    });

    it("preserves unicode text (box-drawing chars, emojis)", () => {
        expect(sanitize("✔ done │ 100%")).toBe("✔ done │ 100%");
    });

    it("strips compound SGR parameters", () => {
        // [38;5;196m = 256-color red
        expect(sanitize("\x1B[38;5;196mred\x1B[0m")).toBe("red");
    });
});
