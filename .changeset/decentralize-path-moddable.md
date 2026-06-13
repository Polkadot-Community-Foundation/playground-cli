---
"playground-cli": minor
---

`playground decentralize --path` can now publish moddable apps: the interactive flow asks "let others remix (mod) this app?" when publishing a local directory to the playground (with the same git-origin preflight and recovery menu as `playground deploy`), and headless mode accepts a `--moddable` flag. Publishing a local directory also inlines the project's README.md as the app's playground detail page — resolved from the enclosing git repo root, so it's found even when `--path` points at a build dir like `./dist` (the same anchor the moddable git-origin preflight walks up to) — and the TUI now says so up front at the publish prompt. Mirrored URL sites are unchanged (no git source — never moddable, no README).
