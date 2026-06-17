---
"playground-cli": patch
---

The dedicated testnet funder seed is no longer hardcoded in the binary. It is
read from the `MASTER_FUNDER_SEED` environment variable (CI injects it from a
repository secret); when unset, funding falls back to Alice alone. This affects
only the E2E suite and operator tooling — no end-user command funds from this
chain.
