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
import {
    detectBuildConfig,
    detectInstallConfig,
    detectPackageManager,
    BuildDetectError,
    type DetectInput,
} from "./detect.js";

function input(overrides: Partial<DetectInput> = {}): DetectInput {
    return {
        packageJson: null,
        lockfiles: new Set(),
        configFiles: new Set(),
        ...overrides,
    };
}

describe("detectPackageManager", () => {
    it("defaults to npm when no lockfile is present", () => {
        expect(detectPackageManager(new Set())).toBe("npm");
    });

    it("picks pnpm over yarn when both lockfiles are present", () => {
        // Mixed lockfiles happen in practice during migrations; we pick the one
        // most likely to be currently maintained.
        expect(detectPackageManager(new Set(["pnpm-lock.yaml", "yarn.lock"]))).toBe("pnpm");
    });

    it("picks yarn when only yarn.lock is present", () => {
        expect(detectPackageManager(new Set(["yarn.lock"]))).toBe("yarn");
    });

    it("picks bun when only bun.lockb is present", () => {
        expect(detectPackageManager(new Set(["bun.lockb"]))).toBe("bun");
    });

    it("picks bun when only bun.lock (bun 1.2+ text lockfile) is present", () => {
        expect(detectPackageManager(new Set(["bun.lock"]))).toBe("bun");
    });
});

describe("detectBuildConfig", () => {
    it("prefers an explicit build script via the detected PM", () => {
        const cfg = detectBuildConfig(
            input({
                packageJson: { scripts: { build: "vite build" } },
                lockfiles: new Set(["pnpm-lock.yaml"]),
            }),
        );
        expect(cfg.cmd).toBe("pnpm");
        expect(cfg.args).toEqual(["run", "build"]);
        expect(cfg.description).toBe("pnpm run build");
        expect(cfg.defaultOutputDir).toBe("dist");
    });

    it("passes npm even without any lockfile", () => {
        const cfg = detectBuildConfig(
            input({
                packageJson: { scripts: { build: "tsc" } },
            }),
        );
        expect(cfg.cmd).toBe("npm");
        expect(cfg.defaultOutputDir).toBe("dist");
    });

    it("infers .next output dir when the build script invokes next", () => {
        const cfg = detectBuildConfig(
            input({
                packageJson: { scripts: { build: "next build" } },
                lockfiles: new Set(["yarn.lock"]),
            }),
        );
        expect(cfg.defaultOutputDir).toBe(".next");
        expect(cfg.cmd).toBe("yarn");
    });

    it("falls back to vite exec when only vite.config.ts is present", () => {
        const cfg = detectBuildConfig(
            input({
                packageJson: { dependencies: { vite: "^5.0.0" } },
                lockfiles: new Set(["bun.lockb"]),
                configFiles: new Set(["vite.config.ts"]),
            }),
        );
        expect(cfg.cmd).toBe("bunx");
        expect(cfg.args).toEqual(["vite", "build"]);
        expect(cfg.description).toBe("bun exec vite build");
        expect(cfg.defaultOutputDir).toBe("dist");
    });

    it("falls back to next exec when only next.config.js is present", () => {
        const cfg = detectBuildConfig(
            input({
                packageJson: { devDependencies: { next: "^14.0.0" } },
                lockfiles: new Set(["pnpm-lock.yaml"]),
                configFiles: new Set(["next.config.js"]),
            }),
        );
        expect(cfg.cmd).toBe("pnpm");
        expect(cfg.args).toEqual(["exec", "next", "build"]);
        expect(cfg.defaultOutputDir).toBe(".next");
    });

    it("falls back to tsc when typescript + tsconfig.json are present", () => {
        const cfg = detectBuildConfig(
            input({
                packageJson: { devDependencies: { typescript: "^5.0.0" } },
                configFiles: new Set(["tsconfig.json"]),
            }),
        );
        expect(cfg.cmd).toBe("npx");
        expect(cfg.args).toEqual(["tsc", "-p", "tsconfig.json"]);
    });

    it("throws BuildDetectError when no strategy matches", () => {
        expect(() => detectBuildConfig(input({ packageJson: { scripts: {} } }))).toThrow(
            BuildDetectError,
        );
    });

    it("throws when typescript is installed but tsconfig.json is missing", () => {
        // tsc without a tsconfig is almost certainly not what the user wants —
        // prefer the clear error over guessing.
        expect(() =>
            detectBuildConfig(
                input({
                    packageJson: { devDependencies: { typescript: "^5.0.0" } },
                }),
            ),
        ).toThrow(BuildDetectError);
    });

    it("throws a wrong-directory error when package.json is missing entirely", () => {
        // A missing package.json almost always means the user is one level
        // above their project (e.g. ran `dot mod` then `dot build` from the
        // parent). Point them at the cwd, not at editing a package.json that
        // isn't there.
        expect(() => detectBuildConfig(input({ packageJson: null }))).toThrow(BuildDetectError);
        expect(() => detectBuildConfig(input({ packageJson: null }))).toThrow(
            /No package\.json found/,
        );
    });

    it("names the project directory in the missing-package.json error", () => {
        expect(() =>
            detectBuildConfig(input({ packageJson: null, projectDir: "/home/me" })),
        ).toThrow(/\/home\/me/);
    });

    it("renders the missing-package.json error cleanly when no projectDir is known", () => {
        // The dir name is optional, so the fallback must not leak `undefined`
        // or a dangling space before the sentence-ending period.
        let message = "";
        try {
            detectBuildConfig(input({ packageJson: null }));
        } catch (err) {
            message = (err as Error).message;
        }
        expect(message).toContain("No package.json found.");
        expect(message).not.toMatch(/undefined/);
        expect(message).not.toMatch(/ {2}/);
    });

    it("keeps the generic build-strategy error when package.json exists but is unrecognised", () => {
        // package.json IS present — the user is in the right place, we just
        // can't infer a build. Keep the original guidance.
        expect(() => detectBuildConfig(input({ packageJson: { scripts: {} } }))).toThrow(
            /No build strategy detected/,
        );
    });
});

describe("detectInstallConfig", () => {
    it("returns an install command even when node_modules already exists (idempotent reconcile)", () => {
        // A stale node_modules/ — e.g. after a branch switch — bypasses any
        // missing-folder guard and lets the build run against package versions
        // that don't match the lockfile. We install unconditionally so that
        // case can't reach the build step.
        expect(
            detectInstallConfig(
                input({
                    packageJson: { dependencies: { vite: "^5.0.0" } },
                    lockfiles: new Set(["pnpm-lock.yaml"]),
                }),
            ),
        ).toEqual({ cmd: "pnpm", args: ["install"], description: "pnpm install" });
    });

    it("returns null when package.json is missing", () => {
        expect(detectInstallConfig(input())).toBeNull();
    });

    it("returns null when the project declares no dependencies", () => {
        // A package.json with scripts but no deps has nothing to install; we
        // shouldn't pointlessly spawn `npm install`.
        expect(
            detectInstallConfig(
                input({
                    packageJson: { scripts: { build: "echo hi" } },
                }),
            ),
        ).toBeNull();
    });

    it("returns the npm install command when no lockfile is present", () => {
        expect(
            detectInstallConfig(
                input({
                    packageJson: { devDependencies: { vite: "^7.0.0" } },
                }),
            ),
        ).toEqual({ cmd: "npm", args: ["install"], description: "npm install" });
    });

    it("picks the install command matching the detected lockfile", () => {
        expect(
            detectInstallConfig(
                input({
                    packageJson: { dependencies: { react: "^19.0.0" } },
                    lockfiles: new Set(["pnpm-lock.yaml"]),
                }),
            ),
        ).toEqual({ cmd: "pnpm", args: ["install"], description: "pnpm install" });

        expect(
            detectInstallConfig(
                input({
                    packageJson: { dependencies: { react: "^19.0.0" } },
                    lockfiles: new Set(["bun.lockb"]),
                }),
            ),
        ).toEqual({ cmd: "bun", args: ["install"], description: "bun install" });

        expect(
            detectInstallConfig(
                input({
                    packageJson: { dependencies: { react: "^19.0.0" } },
                    lockfiles: new Set(["yarn.lock"]),
                }),
            ),
        ).toEqual({ cmd: "yarn", args: ["install"], description: "yarn install" });
    });
});
