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

/**
 * The QR scan phase of `playground login`, run BEFORE Ink mounts.
 *
 * Why this is not an Ink component: the QR is ~33 rows tall. If it lived inside
 * Ink's re-rendered region, the frame would exceed the terminal height and
 * Ink could not cursor back up to erase it — it would leave the QR on screen
 * and redraw the whole frame lower down (the duplication bug). So we own the
 * cursor here: print the QR, wait for the phone to scan + finish auth (with a
 * single in-place status line), then erase the entire block with a cursor-up +
 * clear-to-end-of-screen sequence. Only after the QR is gone does the caller
 * mount the (small) Ink result screen — nothing tall ever enters Ink's frame.
 */

import { waitForLogin as realWaitForLogin } from "../../utils/auth.js";
import type { LoginHandle, LoginStatus, SessionAddresses } from "../../utils/auth.js";
import { GLYPH, LAYOUT, TIMING } from "../../utils/ui/theme/index.js";

const INDENT = " ".repeat(LAYOUT.leftMargin);
const CAPTION = `${INDENT}Scan with the Polkadot mobile app to log in:`;

export interface QrScanResult {
    addresses: SessionAddresses | null;
    error: string | null;
}

interface OutStream {
    write(s: string): unknown;
    isTTY?: boolean;
}

interface RunQrScanPhaseOptions {
    out?: OutStream;
    waitForLoginFn?: (
        login: LoginHandle,
        onStatus: (status: LoginStatus) => void,
    ) => Promise<string | null>;
    /** Animate the status spinner on a timer. Disabled in tests. */
    animate?: boolean;
}

/**
 * ANSI to erase a just-printed block of `lines` rows whose final row currently
 * holds the cursor, leaving the cursor at the block's top-left. The next write
 * (Ink's first frame) then lands exactly where the block was.
 */
export function eraseBlockSequence(lines: number): string {
    if (lines <= 0) return "";
    if (lines === 1) return "\r\x1b[0J";
    return `\r\x1b[${lines - 1}A\x1b[0J`;
}

/** Human-readable status for the single scan-phase status line. */
export function scanStatusLabel(status: LoginStatus): string {
    switch (status.step) {
        case "waiting":
            return "waiting for you to scan…";
        case "pending":
            // The host's `stage` is an internal CamelCase enum name
            // ("AllowanceAllocation", …) — never show it; use a friendly label.
            return "syncing…";
        case "paired":
            return "paired, finalizing…";
        case "success":
            return "signed in";
        case "error":
            return status.message;
    }
}

export async function runQrScanPhase(
    login: LoginHandle,
    qrCode: string,
    options: RunQrScanPhaseOptions = {},
): Promise<QrScanResult> {
    const out = options.out ?? process.stdout;
    const waitForLoginFn = options.waitForLoginFn ?? realWaitForLogin;
    const isTty = Boolean(out.isTTY);
    const animate = options.animate ?? true;

    const qrBody = qrCode.replace(/\n+$/, "");
    const qrRows = qrBody.split("\n").length;
    // caption + blank + qrRows + blank + status line.
    //
    // This assumes each printed line occupies exactly one terminal row (no
    // soft-wrap). That holds whenever the QR is usable: a QR narrower than the
    // terminal is the precondition for scanning it at all, and the caption /
    // status line are both shorter than the QR. On a terminal too narrow to
    // show the QR (already unscannable), wrapping can leave a few orphan rows
    // after the erase — a benign cosmetic artifact, never the old duplication.
    const blockLines = qrRows + 4;

    // Caption, blank, QR, blank — then the status line is written below.
    out.write(`${CAPTION}\n\n${qrBody}\n\n`);

    let label = scanStatusLabel({ step: "waiting" });
    let tick = 0;

    const renderStatus = () => {
        if (isTty) {
            const frame = GLYPH.spinner[tick % GLYPH.spinner.length];
            out.write(`\r\x1b[K${INDENT}${frame} ${label}`);
        } else {
            out.write(`${INDENT}${label}\n`);
        }
    };
    renderStatus();

    let timer: ReturnType<typeof setInterval> | undefined;
    if (isTty && animate) {
        timer = setInterval(() => {
            tick++;
            renderStatus();
        }, TIMING.spinnerMs);
        timer.unref?.();
    }

    let addresses: SessionAddresses | null = null;
    let error: string | null = null;
    try {
        await waitForLoginFn(login, (status) => {
            label = scanStatusLabel(status);
            if (status.step === "success") addresses = status.addresses;
            if (status.step === "error") error = status.message;
            renderStatus();
        });
    } catch (err) {
        // `waitForLogin` has no internal catch — an authPromise rejection or a
        // loadSessions throw propagates here. Capture it instead of rethrowing
        // so the QR is ALWAYS erased below (a rethrow would strand it on
        // screen) and the caller surfaces the message on the result screen.
        error = err instanceof Error ? err.message : String(err);
    } finally {
        if (timer) clearInterval(timer);
    }

    // Erase the whole block so the QR is gone before Ink renders the result.
    if (isTty) {
        out.write(eraseBlockSequence(blockLines));
    } else {
        out.write("\n");
    }

    return { addresses, error };
}
