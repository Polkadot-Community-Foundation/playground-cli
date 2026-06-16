---
"playground-cli": minor
---

`playground mod` now detects the package manager a project uses (pnpm/yarn/bun/npm)
and, when it (or Node.js) is missing, offers to install it with one confirmation
before running the project's setup, instead of failing with a confusing error.
`playground deploy` and `playground build` install a missing manager automatically
as part of the build step. macOS and Linux are supported; non-interactive runs
install without prompting.
