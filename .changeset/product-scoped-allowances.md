---
"playground-cli": patch
---

Fix PGAS smart-contract allowance landing on the wrong account, and fix the login mapping check reporting false "NOT mapped". RFC-0010 allowance requests now send `playground.dot` as the calling product id instead of the terminal's `dot-cli` namespace, so the phone's `Pgas.claim_pgas` mints to the playground product account (`playground.dot/0`) — creating, auto-mapping, and gas-funding it in one step, with no dev-account funding. Previously the claim targeted `dot-cli/0`, leaving the real product account unmapped. The login mapping verification now reads the best head (finalization on paseo-next-v2 lags ~80 s behind the just-included claim, so the old finalized-head read missed freshly-mapped accounts) with a short retry window. Existing sessions re-grant once on the next `playground login` (single approval dialog); the phone's approval prompt now also names the playground product instead of `dot-cli`.
