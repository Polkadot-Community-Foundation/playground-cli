---
"playground-cli": patch
---

Update bundled dependencies to their latest stable releases:

- `@parity/polkadot-app-deploy` 0.10.0 → 0.11.0 — headline reliability fix:
  resolves the nonce-collision / GRANDPA re-upload reconnect bug (upstream
  #946), so a WebSocket halt mid re-upload now recovers via `doReconnect()`
  instead of failing the deploy. Additive drop-in otherwise (`deploy()`
  signature and the `DeployOptions` we use are unchanged).
- `@parity/cdm-builder` 3.1.5 → 3.1.6 (exact), `@parity/cdm-codegen`
  0.6.18 → 0.6.19 (exact), `@parity/cdm-env` ^2.0.5 → ^2.0.6 — the cdm-env
  bump ships the Summit `w3s` meta-registry address.
- `@parity/dotns-cli` 0.6.8 → 0.7.2 (exact) — bundled-binary refresh; the
  CLI consumes only `dist/cli.js`.
- Refreshed the `@parity/product-sdk-*` caret floors: contracts ^0.7.7,
  cloud-storage ^0.6.4, keys ^0.3.10, tx ^0.2.14.
