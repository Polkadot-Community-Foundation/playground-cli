---
"playground-cli": patch
---

Fix mod-of-a-mod XP attribution for SDK/RevX deploys. The `moddedFrom` lineage
field was only rewritten by the `dot mod` TUI, while SDK consumers that clone a
source app themselves (RevX in a WebContainer) and deploy via `runDeploy` re-published
whatever `moddedFrom` the cloned repo's `dot.json` carried. Because a moddable app
that was itself modded from the tutorial ships `moddedFrom: <tutorial>` in its
committed `dot.json`, modding such an app credited the tutorial's owner instead of
the immediate parent's owner (playground-app#335).

`runDeploy` now accepts an explicit `moddedFrom`, and an explicit value takes
precedence over the (possibly stale) `dot.json` field so callers that just performed
the mod record the true immediate parent. The resolved value drives both the on-chain
lineage edge and the metadata JSON `moddedFrom` (so the badge and the XP credit can't
disagree), and is canonicalized to `<label>.dot` — an empty or malformed explicit value
falls through to `dot.json` rather than recording garbage on-chain.
