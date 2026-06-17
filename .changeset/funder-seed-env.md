---
"playground-cli": patch
---

The dedicated testnet funder seed is no longer hardcoded in the binary. It is
read from the `MASTER_FUNDER_SEED` environment variable (CI injects it from a
repository secret); when unset, funding falls back to Alice alone. The dedicated
funder is now the primary account (drawn down ahead of public Alice) and is
derived at the bare root (empty derivation path). This affects only the E2E
suite and operator tooling — no end-user command funds from this chain.
