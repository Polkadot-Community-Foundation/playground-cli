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

import { spawn } from "node:child_process";
import { mkdtempSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, relative, sep } from "node:path";

export interface MirrorOptions {
    /** http(s) URL to mirror. Other schemes are rejected. */
    url: string;
    /** Optional callback for streaming wget output, one line at a time. */
    onLine?: (line: string) => void;
    /**
     * @internal Override the binary that gets spawned. Tests use this to point
     * at a deliberately-missing path (to exercise the `WgetMissingError`
     * branch) or at `/usr/bin/true` (to exercise the empty-mirror branch
     * without making a network request). Production callers leave this unset.
     */
    wgetBinary?: string;
}

export interface MirrorResult {
    /** Absolute path to the temp directory wget wrote into. Owned by the
     *  caller — passed to `rm -rf` once the upload finishes. */
    directory: string;
    /**
     * Directory to actually upload — the parent of the shallowest
     * `index.html`. Equals `directory` when the URL has no path (`/`); for
     * URLs like `https://host/foo/bar/`, wget writes to `directory/foo/bar/`
     * because `--no-host-directories` strips only the hostname segment, so
     * we resolve down to the actual document root before handing off.
     */
    uploadRoot: string;
    /** Number of files written under `directory` (NOT `uploadRoot`). */
    fileCount: number;
}

export class WgetMissingError extends Error {
    constructor() {
        super(
            "wget is required to mirror sites but was not found on PATH. " +
                "Install it via `brew install wget` (macOS) or your package manager.",
        );
        this.name = "WgetMissingError";
    }
}

export class InvalidSiteUrlError extends Error {
    constructor(url: string, reason: string) {
        super(`Invalid --site URL "${url}": ${reason}`);
        this.name = "InvalidSiteUrlError";
    }
}

/**
 * Normalise a user-typed site URL into the canonical `http(s)://…` form that
 * `wget` will accept. Exported so the TUI and unit tests can validate
 * candidate input without going through the whole mirror pipeline.
 */
export function validateUrl(input: string): string {
    let parsed: URL;
    try {
        parsed = new URL(input);
    } catch {
        // Allow shorthand like "shawntabrizi.github.io" by adding https://.
        try {
            parsed = new URL(`https://${input}`);
        } catch {
            throw new InvalidSiteUrlError(input, "not a parseable URL");
        }
    }
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
        throw new InvalidSiteUrlError(input, `unsupported scheme ${parsed.protocol}`);
    }
    return parsed.toString();
}

/**
 * Classify a normalised URL as directory-shaped (bare host, `/`, or a
 * trailing-slash path) vs. a specific page. wget only writes a literal
 * `index.html` for directory-shaped URLs; page URLs are named after the last
 * path segment, which drives the two mirror strategies in `mirrorSite`.
 */
export function isDirectoryStyleUrl(url: string): boolean {
    const { pathname } = new URL(url);
    return pathname === "" || pathname === "/" || pathname.endsWith("/");
}

/**
 * BFS for the directory containing the shallowest `index.html`. Used as
 * the upload root so Bulletin's renderer always sees `index.html` at the
 * top level regardless of URL path depth.
 *
 * Root cause this guards against: `wget --no-host-directories` strips only
 * the hostname segment, so `https://host/foo/bar/` writes
 * `<tmp>/foo/bar/index.html` — not `<tmp>/index.html`. Uploading the wget
 * directory verbatim would put a directory at the IPFS root with no
 * document, producing "Archive missing index.html" at view time.
 *
 * Returns `null` when no `index.html` exists anywhere in the tree (e.g.
 * dynamic sites that need server-side rendering); callers should surface
 * that to the user rather than upload an unrenderable archive.
 */
export function findIndexHtmlRoot(rootDir: string): string | null {
    const queue: string[] = [rootDir];
    while (queue.length > 0) {
        const dir = queue.shift()!;
        let entries: string[];
        try {
            entries = readdirSync(dir);
        } catch {
            continue;
        }
        if (entries.includes("index.html")) return dir;
        for (const entry of entries) {
            const full = join(dir, entry);
            try {
                if (statSync(full).isDirectory()) queue.push(full);
            } catch {
                // dangling symlink / permission error — skip
            }
        }
    }
    return null;
}

/**
 * BFS for the shallowest `.html`/`.htm` file anywhere under `rootDir`. Used as
 * the entry-document fallback in page mode when the URL-derived filename guess
 * misses (e.g. wget mangled the name). Returns `null` when the tree has no
 * HTML document at all (client-rendered SPA / redirect-only response).
 */
export function findShallowestHtml(rootDir: string): string | null {
    const queue: string[] = [rootDir];
    while (queue.length > 0) {
        const dir = queue.shift()!;
        let entries: string[];
        try {
            // Sort for deterministic results across filesystems when several
            // HTML files share the shallowest depth.
            entries = readdirSync(dir).sort();
        } catch {
            continue;
        }
        const subdirs: string[] = [];
        for (const entry of entries) {
            const full = join(dir, entry);
            let isDir = false;
            try {
                const st = statSync(full);
                if (st.isFile() && /\.html?$/i.test(entry)) return full;
                isDir = st.isDirectory();
            } catch {
                continue; // dangling symlink / permission error — skip
            }
            if (isDir) subdirs.push(full);
        }
        queue.push(...subdirs);
    }
    return null;
}

/**
 * Locate the HTML document wget saved for a page URL. Tries the filename wget
 * would have written (`<last-path-segment>` with `.html` appended by
 * `--adjust-extension`) first, then falls back to the shallowest HTML file in
 * the tree. Returns `null` when no HTML document exists (SPA / redirect-only).
 */
export function resolveEntryDocument(directory: string, url: string): string | null {
    const parsed = new URL(url);
    const stripped = parsed.pathname.replace(/^\/+/, "");
    let rel: string;
    try {
        rel = decodeURIComponent(stripped);
    } catch {
        rel = stripped;
    }
    const candidates: string[] = [];
    if (rel && !rel.endsWith("/")) {
        // Page mode keeps per-host directories (no `--no-host-directories`), so
        // wget writes the document at `<host>/<path>`. Try that first, then the
        // host-less form for robustness, before the shallowest-html fallback.
        for (const base of [`${parsed.host}/${rel}`, rel]) {
            if (/\.html?$/i.test(base)) candidates.push(base);
            else candidates.push(`${base}.html`, base);
        }
    }
    for (const candidate of candidates) {
        const full = join(directory, candidate);
        try {
            if (statSync(full).isFile()) return full;
        } catch {
            // not this candidate — try the next
        }
    }
    return findShallowestHtml(directory);
}

/**
 * Materialise a root `index.html` for a page-mode mirror by copying the entry
 * document there and injecting `<base href="<entry-dir>/">`. Page mode keeps
 * per-host directories, so the document is nested (e.g.
 * `en.wikipedia.org/wiki/Maungatapere.html`) and `--convert-links` rewrote its
 * asset links relative to that directory. The `<base>` makes those links
 * resolve from the root exactly as they did when nested — so the viewer
 * renders the real page directly, with no redirect or iframe (Bulletin's
 * viewer does NOT honour a `<meta http-equiv="refresh">` redirect — it renders
 * the stub but never navigates).
 */
export function writeEntryIndex(directory: string, entryPath: string): void {
    const relDir = relative(directory, dirname(entryPath)).split(sep).join("/");
    const baseHref = relDir ? `${relDir.split("/").map(encodeURIComponent).join("/")}/` : "./";
    const baseTag = `<base href="${baseHref}">`;
    const source = readFileSync(entryPath, "utf8");
    const head = source.match(/<head[^>]*>/i);
    const html = head
        ? source.slice(0, head.index! + head[0].length) +
          baseTag +
          source.slice(head.index! + head[0].length)
        : baseTag + source;
    writeFileSync(join(directory, "index.html"), html, "utf8");
}

/**
 * Recursive file count under `root`. Used after a wget run to detect the
 * empty-mirror case (success exit, zero files). Exported for tests.
 */
export function countFiles(root: string): number {
    let count = 0;
    const walk = (dir: string) => {
        for (const entry of readdirSync(dir)) {
            const full = join(dir, entry);
            const st = statSync(full);
            if (st.isDirectory()) walk(full);
            else if (st.isFile()) count++;
        }
    };
    try {
        walk(root);
    } catch {
        // ignore — caller validates non-empty via the returned count.
    }
    return count;
}

/**
 * Decide whether a finished wget run failed, judging by what landed on disk
 * rather than the exit code alone. wget exits non-zero (commonly 8, "server
 * issued an error response") whenever ANY requisite 404s — routine with
 * `--page-requisites --span-hosts`, where one missing CDN asset would
 * otherwise abort an otherwise-perfect mirror. So a non-zero exit is only
 * fatal when nothing was downloaded. Returns an error message, or `null` when
 * the run is usable. Exported for tests.
 */
export function describeWgetFailure(
    code: number | null,
    fileCount: number,
    url: string,
): string | null {
    if (fileCount > 0) return null;
    if (code === 0) {
        return `wget completed but no files were downloaded from ${url}. The site may be empty or block crawlers.`;
    }
    return `wget failed (exit ${code ?? "unknown"}) from ${url} and downloaded nothing — the site may be unreachable.`;
}

/**
 * Mirror a live HTTP(S) static site into a fresh temp directory using `wget`.
 *
 * Two strategies, chosen by `isDirectoryStyleUrl`:
 *   - Directory / bare-host / trailing-slash URL → recursive whole-site mirror
 *     (`--mirror --no-parent`), upload root resolved by `findIndexHtmlRoot`.
 *   - Specific page URL → page + requisites with NO link recursion
 *     (`--page-requisites --span-hosts -e robots=off`, per-host directories
 *     kept), then a root `index.html` materialised from the entry document
 *     with an injected `<base>` (see `writeEntryIndex`).
 *
 * Shared flags:
 *   --convert-links       rewrite absolute → relative so the local copy renders
 *   --adjust-extension    add .html so links resolve from a flat filesystem
 *   --no-host-directories drop the hostname segment from the output path
 *   --no-verbose          one progress line per file; not silent so onLine works
 *
 * URL safety: passed as a separate execve argument, never spliced into a shell
 * string, so a malicious URL cannot inject other flags or shell metacharacters.
 */
export async function mirrorSite(options: MirrorOptions): Promise<MirrorResult> {
    const url = validateUrl(options.url);
    const directory = mkdtempSync(join(tmpdir(), "dot-decentralize-"));

    const directoryStyle = isDirectoryStyleUrl(url);
    const args = directoryStyle
        ? [
              // Directory / whole-site mirror (unchanged behaviour).
              "--mirror",
              "--convert-links",
              "--adjust-extension",
              "--page-requisites",
              "--no-parent",
              "--no-host-directories",
              "--no-verbose",
              `--directory-prefix=${directory}`,
              url,
          ]
        : [
              // Single page: the page plus every requisite (CSS/JS/images,
              // incl. cross-host CDN assets) with NO link recursion. `--mirror`
              // + `-e robots=off` would crawl an entire link-heavy site (all of
              // Wikipedia under /wiki/) — robots.txt was the only bound on the
              // infinite recursion. `--page-requisites` with no `-r` keeps the
              // download to exactly what this page needs. We KEEP per-host
              // directories here (no `--no-host-directories`): `--span-hosts`
              // pulls assets from multiple hosts, and flattening them by path
              // would let two hosts collide on the same path (clobbered/`.1`
              // files + broken converted links).
              "--page-requisites",
              "--convert-links",
              "--adjust-extension",
              "--span-hosts",
              "--no-verbose",
              "-e",
              "robots=off",
              `--directory-prefix=${directory}`,
              url,
          ];

    const exitCode = await new Promise<number | null>((resolve, reject) => {
        const proc = spawn(options.wgetBinary ?? "wget", args, {
            stdio: ["ignore", "pipe", "pipe"],
        });

        proc.on("error", (err: NodeJS.ErrnoException) => {
            if (err.code === "ENOENT") reject(new WgetMissingError());
            else reject(err);
        });

        const forward = (chunk: Buffer) => {
            if (!options.onLine) return;
            for (const line of chunk.toString("utf8").split("\n")) {
                if (line.trim()) options.onLine(line);
            }
        };
        proc.stdout?.on("data", forward);
        proc.stderr?.on("data", forward);

        // Resolve with the exit code (don't reject on non-zero): a missing
        // requisite makes wget exit 8 even on an otherwise-complete mirror.
        // `describeWgetFailure` judges success by what landed on disk instead.
        proc.on("close", (code) => resolve(code));
    });

    const fileCount = countFiles(directory);
    const failure = describeWgetFailure(exitCode, fileCount, url);
    if (failure) throw new Error(failure);

    const noIndexHtmlError = new Error(
        `wget downloaded ${fileCount} files from ${url} but found no HTML document. ` +
            "Bulletin's viewer needs an index.html at the root — the site may be " +
            "fully client-side-rendered or served from a redirect.",
    );

    if (directoryStyle) {
        const uploadRoot = findIndexHtmlRoot(directory);
        if (!uploadRoot) throw noIndexHtmlError;
        return { directory, uploadRoot, fileCount };
    }

    // Page mode: wget named the document after the URL's last path segment
    // under a per-host dir (e.g. `en.wikipedia.org/wiki/Maungatapere.html`),
    // never `index.html`. Upload the whole tree and materialise a root
    // index.html from the entry doc with a `<base>` so the viewer renders the
    // real page directly. Recount afterwards so the synthesized file is
    // included. See `writeEntryIndex`.
    const entry = resolveEntryDocument(directory, url);
    if (!entry) throw noIndexHtmlError;
    const relTarget = relative(directory, entry).split(sep).join("/");
    if (relTarget !== "index.html") writeEntryIndex(directory, entry);
    return { directory, uploadRoot: directory, fileCount: countFiles(directory) };
}
