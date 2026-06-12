---
"playground-cli": minor
---

`playground decentralize --path` can now publish moddable apps: the interactive flow asks "let others remix (mod) this app?" when publishing a local directory to the playground (with the same git-origin preflight and recovery menu as `playground deploy`), and headless mode accepts a `--moddable` flag. Publishing a local directory also inlines its README.md as the app's playground detail page, and the TUI now says so up front at the publish prompt. Mirrored URL sites are unchanged (no git source — never moddable, no README).
