---
"playground-cli": patch
---

Fix the deploy/TUI header breadcrumb garbling when a long domain overflows the row: the command no longer gets clipped ("playground deplo"), the domain keeps its ".dot" suffix, and the version label keeps a gap instead of gluing onto the network name. The header now degrades gracefully (narrower separators, then middle-truncation that preserves the ".dot" suffix) instead of letting the layout engine shrink every piece.
