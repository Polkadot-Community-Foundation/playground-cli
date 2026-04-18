---
"playground-cli": minor
---

New editorial TUI: every screen now renders through a single theme plug
(`src/utils/ui/theme/`) — swap that folder to reskin the CLI, stub it to
strip styling, zero styling leaks into commands.

`dot init` now surfaces bulletin attestation status on every run — even
for already-signed-in users — showing how long your upload quota is valid
for in human-readable form (e.g. `~13d 4h · #14,582,331`), with warning
color when expiry drops under 24 h.

Bonus: the terminal tab title updates during long deploys, so
`dot deploy` shows build / upload / publish / ✓ in your tab strip while
you tab away to the browser.
