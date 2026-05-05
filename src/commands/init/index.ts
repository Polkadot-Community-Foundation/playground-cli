import React from "react";
import { Command } from "commander";
import { render } from "ink";
import { captureWarning, withSpan, errorMessage } from "../../telemetry.js";
import { runCliCommand } from "../../cli-runtime.js";
import { InitScreen } from "./InitScreen.js";
import { connect, type LoginHandle } from "../../utils/auth.js";
import { getGhToken } from "../../utils/gh-token.js";
import { formatGhAuthBanner } from "./gh-auth-banner.js";

export const initCommand = new Command("init")
    .description("Install prerequisites and login via mobile QR")
    .option("-y, --yes", "Skip interactive prompts")
    .action(async (opts) =>
        runCliCommand("init", { hardExit: false }, async () => {
            console.log();

            let login: LoginHandle | null = null;
            let existingAddress: string | null = null;

            if (!opts.yes) {
                try {
                    const result = await withSpan(
                        "cli.init.login",
                        "login via mobile session",
                        () => connect(),
                    );
                    if (result.kind === "existing") {
                        existingAddress = result.address;
                    } else {
                        login = result.login;
                        console.log("  Scan with the Polkadot mobile app to log in:\n");
                        console.log(result.qrCode);
                    }
                } catch (err) {
                    const msg = errorMessage(err);
                    captureWarning("Init login service unavailable, continuing setup", {
                        error: msg,
                    });
                    console.log(`  Login skipped: ${msg}\n`);
                }
            }

            const app = render(
                React.createElement(InitScreen, {
                    login,
                    existingAddress,
                    onDone: () => app.unmount(),
                }),
            );
            await withSpan("cli.init.setup", "run init setup", () => app.waitUntilExit());

            console.log();

            // The dependency list above already flags `gh auth login` as a
            // single-row warning, but that doesn't convey why it matters for
            // hackathons / shared WiFi. Print an explicit explanation at the
            // very bottom for users who are still logged out, so the
            // recommendation has the context it needs to land.
            const token = await getGhToken();
            if (!token) process.stderr.write(formatGhAuthBanner());
        }),
    );
