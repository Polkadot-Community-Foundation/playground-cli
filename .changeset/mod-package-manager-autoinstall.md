---
"playground-cli": minor
---

`playground mod` and deploy now detect the package manager a project uses
(pnpm/yarn/bun/npm) and offer to install it — plus Node.js when needed — instead
of failing with a confusing error when it's missing. macOS and Linux are
supported; non-interactive runs auto-install.
