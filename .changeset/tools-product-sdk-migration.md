---
"playground-cli": patch
---

Migrate the diagnostic tools (`tools/list-registry-apps.ts`, `tools/probe-registry-resolution.ts`) off direct `@polkadot-apps/*` imports onto `@parity/product-sdk-{contracts,tx,address}`. The list-registry-apps script now hits Paseo's public IPFS gateway directly (since `@parity/product-sdk-bulletin`'s `queryJson` is host-only and these tools run as plain Bun processes). Adds a CI grep guard so direct `@polkadot-apps/*` imports under `src/`, `e2e/`, `scripts/`, `tools/` fail the Format job.
