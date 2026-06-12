---
"playground-cli": patch
---

Surface the real cargo-pvm-contract build error during `pg` install instead of a
generic "Command failed (set -euo pipefail …)". `runShell` now accepts an optional
`description`/`failurePrefix`, and the cargo-pvm-contract toolchain step uses them so
failures report a readable label plus the underlying build output.
