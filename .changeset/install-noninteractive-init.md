---
"playground-cli": patch
---

install.sh now runs `dot init --yes` (non-interactive dep setup) instead of blocking on the mobile QR scan. A follow-up hint tells users to run `dot init` for the full login flow.
