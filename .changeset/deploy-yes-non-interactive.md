---
"playground-cli": patch
---

`playground deploy` no longer crashes with an opaque `Raw mode is not supported on the current process.stdin` error when run without an interactive terminal (agents, CI, piped input). A new `-y, --yes` flag runs the deploy non-interactively using defaults (requires `--domain`; `--signer` defaults to `dev`). When prompts are needed but stdin is not a TTY and `--yes` was not passed, the command now exits with an actionable message pointing at `--yes` instead of the internal Ink crash.
