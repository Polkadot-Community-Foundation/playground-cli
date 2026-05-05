/**
 * `dot deploy --modable` preflight: resolves the public GitHub URL we'll
 * record in the Bulletin metadata. Existing origins are used as-is; gh auth
 * is only needed when we have to create and push a new public repo.
 *
 * The pure `decideRepositoryAction` separates the decision from the I/O so
 * the branching logic is unit-testable without mocking child_process.
 */

import { execFile, execFileSync } from "node:child_process";
import { promisify } from "node:util";
import { commandExists, TOOL_STEPS } from "../toolchain.js";
import { parseGitHubRepoUrl } from "../mod/source.js";
import { ghAuthHeaders } from "../gh-token.js";

const execFileAsync = promisify(execFile);

export type RepositoryAction =
    | { kind: "use-origin"; url: string }
    | { kind: "create"; repoName: string }
    | { kind: "needs-repo-name" };

export interface DecisionInput {
    originUrl: string | null;
    repoName: string | null;
}

export function decideRepositoryAction(input: DecisionInput): RepositoryAction {
    if (input.originUrl) {
        const normalised = input.originUrl.replace(/\.git$/, "");
        return { kind: "use-origin", url: normalised };
    }
    if (input.repoName) return { kind: "create", repoName: input.repoName };
    return { kind: "needs-repo-name" };
}

export class ModablePreflightError extends Error {}

export async function ensureGitInstalled(onLog?: (line: string) => void): Promise<void> {
    if (await commandExists("git")) return;
    const step = TOOL_STEPS.find((s) => s.name === "git");
    if (!step) throw new ModablePreflightError("internal: git step missing from TOOL_STEPS");
    await step.install(onLog);
}

export async function ensureGhInstalled(onLog?: (line: string) => void): Promise<void> {
    if (await commandExists("gh")) return;
    const step = TOOL_STEPS.find((s) => s.name === "GitHub CLI");
    if (!step) throw new ModablePreflightError("internal: gh step missing from TOOL_STEPS");
    await step.install(onLog);
}

/**
 * Ensure `gh` is authenticated. We deliberately do NOT shell out to
 * `gh auth login` from here — even when called from the interactive deploy,
 * Ink owns stdout/stdin and a `stdio: "inherit"` child would race Ink for
 * keystrokes and produce a garbled UI. Instead, repo-creation paths fail with
 * the same actionable message: run `gh auth login` once outside `dot`, then
 * retry. The auth persists across runs, so this is a one-time speedbump per
 * machine.
 */
export async function ensureGhAuthed(): Promise<void> {
    try {
        await execFileAsync("gh", ["auth", "status"]);
        return;
    } catch {
        throw new ModablePreflightError(
            'gh is not authenticated. Run "gh auth login" and retry, or pass --no-modable to skip publishing source.',
        );
    }
}

export function readOrigin(cwd: string): string | null {
    try {
        const raw = execFileSync("git", ["remote", "get-url", "origin"], {
            encoding: "utf8",
            stdio: ["pipe", "pipe", "pipe"],
            cwd,
        });
        return raw.trim();
    } catch {
        return null;
    }
}

export interface ResolveRepoOptions {
    cwd: string;
    repoName: string | null;
    onLog?: (line: string) => void;
    fetch?: typeof fetch;
}

/**
 * Verifies that a GitHub repository URL is publicly accessible.
 *
 * Adds an `Authorization: Bearer <token>` header opportunistically when the
 * user is `gh auth login`'d so the request lands against their personal
 * 5000/hour quota instead of the shared 60/hour anonymous-IP quota — the
 * only reliable defence against blanket rate-limiting on hackathon WiFi
 * (see `src/utils/gh-token.ts`).
 *
 * Throws ModablePreflightError for private/missing repos and for explicit
 * rate-limit responses (so we never silently pass off a private repo as
 * public). Stays lenient for ambiguous 5xx errors.
 */
export async function assertPublicGitHubRepo(url: string, f: typeof fetch = fetch): Promise<void> {
    const ref = parseGitHubRepoUrl(url);
    if (!ref) return;

    let res: Response;
    try {
        res = await f(`https://api.github.com/repos/${ref.owner}/${ref.repo}`, {
            headers: { Accept: "application/vnd.github+json", ...(await ghAuthHeaders()) },
        });
    } catch {
        return; // network error — can't verify, let downstream fail
    }

    if (res.ok) {
        const body = (await res.json()) as { private?: boolean };
        if (body.private) {
            throw new ModablePreflightError(
                `${ref.owner}/${ref.repo} is a private repository — modable apps must use a public repository so users can clone the source`,
            );
        }
        return;
    }

    if (res.status === 404 || res.status === 401) {
        throw new ModablePreflightError(
            `${ref.owner}/${ref.repo} is private or does not exist — modable apps must use a public repository`,
        );
    }
    if (res.status === 403 && res.headers.get("x-ratelimit-remaining") === "0") {
        throw new ModablePreflightError(
            "GitHub rate limit exceeded for unauthenticated requests — could not verify that the repository is public. " +
                'Run "gh auth login" to use your personal 5000/hour quota, then retry.',
        );
    }
    // other non-ok status (5xx, transient server error) — skip check
}

export async function resolveRepositoryUrl(opts: ResolveRepoOptions): Promise<string> {
    const f = opts.fetch ?? fetch;
    const action = decideRepositoryAction({
        originUrl: readOrigin(opts.cwd),
        repoName: opts.repoName,
    });
    if (action.kind === "needs-repo-name") {
        throw new ModablePreflightError(
            "modable preflight: repo name is required when no origin is set",
        );
    }
    if (action.kind === "use-origin") {
        opts.onLog?.(`using existing origin (${action.url})…`);
        await assertPublicGitHubRepo(action.url, f);
        return action.url;
    }

    await ensureGhInstalled(opts.onLog);
    await ensureGhAuthed();

    opts.onLog?.(`creating public github repo "${action.repoName}" and pushing…`);
    try {
        await execFileAsync(
            "gh",
            [
                "repo",
                "create",
                action.repoName,
                "--public",
                "--source=.",
                "--push",
                "--remote=origin",
            ],
            { cwd: opts.cwd },
        );
    } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        throw new ModablePreflightError(`gh repo create failed: ${msg}`);
    }
    const created = readOrigin(opts.cwd);
    if (!created) {
        throw new ModablePreflightError(
            "gh repo create succeeded but origin was not set — investigate manually",
        );
    }
    return created.replace(/\.git$/, "");
}
