---
"playground-cli": patch
---

Bump `bulletin-deploy` from `0.7.20-rc.4` to `0.7.20` stable. The notable change vs rc.4 is PR #369, which lands inside bulletin-deploy the same testnet pre-funding pattern `dot init` adopted in the previous release: `DotNS.connect({ autoAccountMapping: true })` now internally tops up a low-balance signer (`attemptTestnetTopUp` from the bare-master / `//Bob` of the standard dev mnemonic) before submitting the Revive auto-map trigger on paseo-next-v2. Users who skip `dot init` and run `dot deploy` directly will now get the funding just-in-time from bulletin-deploy; users who run `dot init` first get the same outcome front-loaded by the CLI. Both paths no-op when the recipient already holds ≥0.1 PAS, so they don't double-transfer.
