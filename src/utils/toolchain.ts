import { exec, spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { homedir, platform } from "node:os";

/** Async exec — resolves with stdout, rejects on non-zero exit. */
function run(cmd: string, opts?: { shell?: string }): Promise<string> {
    return new Promise((resolve, reject) => {
        exec(cmd, { shell: opts?.shell ?? "/bin/bash" }, (err, stdout) => {
            if (err) reject(err);
            else resolve(stdout);
        });
    });
}

/** Async exec with stdio inherited (user sees output). */
function runInherit(cmd: string): Promise<void> {
    return new Promise((resolve, reject) => {
        const child = spawn(cmd, { stdio: "inherit", shell: "/bin/bash" });
        child.on("close", (code: number) =>
            code === 0 ? resolve() : reject(new Error(`exit ${code}`)),
        );
    });
}

async function commandExists(cmd: string): Promise<boolean> {
    try {
        await run(`command -v ${cmd}`);
        return true;
    } catch {
        return false;
    }
}

async function hasRustNightly(): Promise<boolean> {
    try {
        const out = await run("rustup toolchain list");
        return out.includes("nightly");
    } catch {
        return false;
    }
}

async function hasRustSrc(): Promise<boolean> {
    try {
        const out = await run("rustup component list --toolchain nightly");
        return out.includes("rust-src (installed)");
    } catch {
        return false;
    }
}

async function hasCdm(): Promise<boolean> {
    return (await commandExists("cdm")) && (await commandExists("cargo-pvm-contract"));
}

function isIpfsInitialized(): boolean {
    return existsSync(resolve(homedir(), ".ipfs"));
}

export async function isGhAuthenticated(): Promise<boolean> {
    try {
        await run("gh auth status");
        return true;
    } catch {
        return false;
    }
}

export interface ToolStep {
    name: string;
    check: () => Promise<boolean>;
    install: () => Promise<void>;
    manualHint?: string;
}

export const TOOL_STEPS: ToolStep[] = [
    {
        name: "rustup",
        check: () => commandExists("rustup"),
        install: () =>
            runInherit('curl --proto "=https" --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y'),
        manualHint: "https://rustup.rs",
    },
    {
        name: "Rust nightly",
        check: () => hasRustNightly(),
        install: () => runInherit("rustup toolchain install nightly"),
    },
    {
        name: "rust-src",
        check: () => hasRustSrc(),
        install: () => runInherit("rustup component add rust-src --toolchain nightly"),
    },
    {
        name: "cdm & cargo-pvm-contract",
        check: () => hasCdm(),
        install: () =>
            runInherit(
                "curl -fsSL https://raw.githubusercontent.com/paritytech/contract-dependency-manager/main/install.sh | bash",
            ),
        manualHint:
            "curl -fsSL https://raw.githubusercontent.com/paritytech/contract-dependency-manager/main/install.sh | bash",
    },
    {
        name: "IPFS",
        check: async () => (await commandExists("ipfs")) && isIpfsInitialized(),
        install: async () => {
            if (!(await commandExists("ipfs"))) {
                if (platform() === "darwin" && (await commandExists("brew"))) {
                    await runInherit("brew install ipfs");
                } else if (platform() === "darwin") {
                    await runInherit(
                        "curl -fsSL https://dist.ipfs.tech/kubo/v0.33.2/kubo_v0.33.2_darwin-arm64.tar.gz | tar xz && cd kubo && sudo bash install.sh && cd .. && rm -rf kubo",
                    );
                } else {
                    await runInherit(
                        "curl -fsSL https://dist.ipfs.tech/kubo/v0.33.2/kubo_v0.33.2_linux-amd64.tar.gz | tar xz && cd kubo && sudo bash install.sh && cd .. && rm -rf kubo",
                    );
                }
            }
            if (!isIpfsInitialized()) {
                await runInherit("ipfs init");
            }
        },
        manualHint: "https://docs.ipfs.tech/install/ then run: ipfs init",
    },
    {
        name: "GitHub CLI",
        check: () => commandExists("gh"),
        install: async () => {
            if (await commandExists("brew")) {
                await runInherit("brew install gh");
            } else {
                // GH install instructions: https://github.com/cli/cli/blob/trunk/docs/install_linux.md
                await runInherit(
                    [
                        "(type -p wget >/dev/null || (sudo apt update && sudo apt-get install wget -y))",
                        "sudo mkdir -p -m 755 /etc/apt/keyrings",
                        "out=$(mktemp)",
                        "wget -nv -O$out https://cli.github.com/packages/githubcli-archive-keyring.gpg",
                        "cat $out | sudo tee /etc/apt/keyrings/githubcli-archive-keyring.gpg > /dev/null",
                        "sudo chmod go+r /etc/apt/keyrings/githubcli-archive-keyring.gpg",
                        `echo 'deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/githubcli-archive-keyring.gpg] https://cli.github.com/packages stable main' | sudo tee /etc/apt/sources.list.d/github-cli.list > /dev/null`,
                        "sudo apt update",
                        "sudo apt install gh -y",
                    ].join(" && "),
                );
            }
        },
        manualHint: "https://cli.github.com",
    },
];
