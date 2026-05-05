/**
 * Opportunistic GitHub auth token reader.
 *
 * If the user happens to have `gh` installed and `gh auth login`'d, we route
 * unauthenticated GitHub API calls through their personal 5000/hour quota
 * instead of the shared 60/hour anonymous IP quota — a meaningful protection
 * against rate-limit exhaustion on shared networks (hackathons, conferences,
 * corporate NATs).
 *
 * Returns `null` when:
 *   - `gh` is not installed,
 *   - `gh auth status` reports the user as logged out,
 *   - any execution error occurs (PATH issues, permission errors, …).
 *
 * Cached for the process lifetime: shelling out to `gh` per-request would
 * dominate the latency of the API call we're trying to authenticate.
 */

import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

let cached: Promise<string | null> | null = null;

async function probeGhToken(): Promise<string | null> {
    try {
        const { stdout } = await execFileAsync("gh", ["auth", "token"]);
        const token = stdout.trim();
        return token || null;
    } catch {
        return null;
    }
}

export function getGhToken(): Promise<string | null> {
    if (!cached) cached = probeGhToken();
    return cached;
}

/**
 * Returns request headers with `Authorization: Bearer <token>` when a `gh`
 * token is available, otherwise an empty object. Safe to spread into any
 * `fetch(url, { headers: { ... } })` call.
 */
export async function ghAuthHeaders(): Promise<Record<string, string>> {
    const token = await getGhToken();
    return token ? { Authorization: `Bearer ${token}` } : {};
}

/** Test-only — clears the cached token probe so suites can simulate fresh runs. */
export function resetGhTokenCacheForTests(): void {
    cached = null;
}
