/**
 * GitHub-only source acquisition for `dot mod`.
 *
 * Downloads a public repo's source via `codeload.github.com` (no auth, no
 * git binary needed) and extracts into a target directory. RevX-importable
 * — no React/Ink imports.
 */

export interface GitHubRepoRef {
    owner: string;
    repo: string;
}

export function parseGitHubRepoUrl(url: string): GitHubRepoRef | null {
    if (!url) return null;
    const trimmed = url.trim().replace(/\.git$/, "").replace(/\/$/, "");
    const m = trimmed.match(/^(?:https?:\/\/github\.com\/|git@github\.com:)([^/]+)\/([^/]+)$/);
    if (!m) return null;
    return { owner: m[1], repo: m[2] };
}
