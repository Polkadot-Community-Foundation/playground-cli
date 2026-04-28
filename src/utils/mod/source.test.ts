import { describe, it, expect } from "vitest";
import { parseGitHubRepoUrl } from "./source.js";

describe("parseGitHubRepoUrl", () => {
    it("parses https github URL", () => {
        expect(parseGitHubRepoUrl("https://github.com/foo/bar")).toEqual({ owner: "foo", repo: "bar" });
    });

    it("parses https github URL with .git suffix", () => {
        expect(parseGitHubRepoUrl("https://github.com/foo/bar.git")).toEqual({ owner: "foo", repo: "bar" });
    });

    it("parses ssh github URL", () => {
        expect(parseGitHubRepoUrl("git@github.com:foo/bar.git")).toEqual({ owner: "foo", repo: "bar" });
    });

    it("parses URL with trailing slash", () => {
        expect(parseGitHubRepoUrl("https://github.com/foo/bar/")).toEqual({ owner: "foo", repo: "bar" });
    });

    it("returns null for non-GitHub URLs", () => {
        expect(parseGitHubRepoUrl("https://gitlab.com/foo/bar")).toBeNull();
    });

    it("returns null for malformed input", () => {
        expect(parseGitHubRepoUrl("not a url")).toBeNull();
        expect(parseGitHubRepoUrl("https://github.com/foo")).toBeNull();
        expect(parseGitHubRepoUrl("")).toBeNull();
    });
});
