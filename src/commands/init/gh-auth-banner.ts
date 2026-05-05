/**
 * End-of-init advisory shown when the user is not `gh auth login`'d.
 *
 * Visually mirrors the in-Ink `Callout` (see `src/utils/ui/theme/Callout.tsx`)
 * used by the "check your phone" deploy prompt — rounded yellow box with a
 * bold colored title — so the two warnings read as one design language. We
 * render in raw ANSI rather than mounting Ink, because this banner fires
 * after the init TUI has unmounted.
 *
 * The dependency list inside the TUI already shows a single-row warning
 * "authenticated  run: gh auth login", but that's too terse to convey *why*
 * it matters for hackathon / shared-network setups. This banner spells that
 * out at the very bottom of the init output.
 */

import { LAYOUT } from "../../utils/ui/theme/tokens.js";

const BOX_WIDTH = LAYOUT.ruleWidthMax; // 72 — matches the rest of the CLI's max width
const INNER_WIDTH = BOX_WIDTH - 4; // 2 borders + 2 padding spaces

const ANSI_YELLOW = "\x1b[33m";
const ANSI_BOLD = "\x1b[1m";
const ANSI_RESET = "\x1b[0m";

const TL = "╭";
const TR = "╮";
const BL = "╰";
const BR = "╯";
const HORIZONTAL = "─";
const VERTICAL = "│";

const ANSI_RE = /\x1b\[[0-9;]*m/g;

function visibleLength(s: string): number {
    return s.replace(ANSI_RE, "").length;
}

function row(content: string): string {
    const pad = Math.max(0, INNER_WIDTH - visibleLength(content));
    return `  ${ANSI_YELLOW}${VERTICAL}${ANSI_RESET} ${content}${" ".repeat(pad)} ${ANSI_YELLOW}${VERTICAL}${ANSI_RESET}\n`;
}

function border(left: string, right: string): string {
    const fill = HORIZONTAL.repeat(BOX_WIDTH - 2);
    return `  ${ANSI_YELLOW}${left}${fill}${right}${ANSI_RESET}\n`;
}

export function formatGhAuthBanner(): string {
    const title = `${ANSI_YELLOW}${ANSI_BOLD}GitHub authentication recommended${ANSI_RESET}`;
    const ghLogin = `${ANSI_BOLD}gh auth login${ANSI_RESET}`;

    return (
        "\n" +
        border(TL, TR) +
        row(title) +
        row("") +
        row(`Without ${ghLogin}, GitHub rate-limits all requests from your`) +
        row("public IP to 60/hour, shared with everyone on the same network.") +
        row(`This will exhaust quickly on public wifis. Run ${ghLogin} once`) +
        row("to use your personal 5000/hour quota instead.") +
        border(BL, BR) +
        "\n"
    );
}
