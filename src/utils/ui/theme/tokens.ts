/**
 * Design tokens — the entire identity of the CLI's TUI in one file.
 *
 * To restyle the CLI, edit this file.
 * To reskin it, swap every component in this directory.
 * To strip it, replace the `index.tsx` exports with passthrough components
 * that render plain `<Text>` — everything else keeps working.
 *
 * Hard rule: no color literals, no glyph literals, no spacing numbers
 * anywhere in `src/commands/*`. They all live here.
 *
 * Why named ANSI colors only: the 16 named colors are safe under every
 * popular terminal theme (light / dark / solarized / gruvbox / dracula).
 * Truecolor is intentionally avoided — we don't fight the user's palette.
 */

export const COLOR = {
    accent: "magenta",
    success: "green",
    danger: "red",
    warning: "yellow",
} as const;

export const GLYPH = {
    ok: "✓",
    fail: "✕",
    warn: "⚠",
    pending: "·",
    cursor: "›",
    separator: "·",
    rule: "─",
    cursorBlock: "█",
    spinner: ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"] as const,
    bars: ["▁", "▂", "▃", "▄", "▅", "▆", "▇", "█"] as const,
} as const;

export const LAYOUT = {
    leftMargin: 2,
    ruleWidthMax: 72,
    defaultLabelWidth: 14,
} as const;

export const TIMING = {
    spinnerMs: 80,
} as const;
