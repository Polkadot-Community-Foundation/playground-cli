---
"playground-cli": minor
---

Add `playground drip` — top up your signed-in account with a little testnet PAS (1 PAS per run, up to a 10 PAS cap) when you're running low. It funds only your own product account (the one paired via `playground login`), not arbitrary addresses. If you're not signed in, or the shared dev funder is temporarily empty, it shows a clear note instead of an error.
