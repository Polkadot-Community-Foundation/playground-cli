---
"playground-cli": patch
---

`dot init` now funds the product-derived account from the shared bulletin-deploy dev signer (1 PAS, idempotent: skipped when the recipient already holds ≥0.1 PAS) instead of submitting an explicit `Revive.map_account`. paseo-next-v2's `pallet_revive::AutoMapper` handles the SS58 ↔ H160 mapping on the first state-changing tx; the funding step gives that tx enough PAS to land. A belt-and-braces `Revive.map_account` still fires if `checkMapping` returns false after funding, so cold-start accounts that pre-existed the AutoMapper runtime upgrade aren't left stuck.

Also silences the recurring `DestroyedError: Client destroyed` block printed on every `dot init` exit. Root cause was `@sentry/node`'s default `OnUnhandledRejection` integration printing the rejection via `console.warn` + `console.error`; we now override it with `mode: 'none'` so Sentry still captures the rejection with the full `mechanism: onunhandledrejection` metadata but skips the print. Benign polkadot-api teardown artifacts are dropped via `beforeSend` so they don't reach the Failures dashboard either.
