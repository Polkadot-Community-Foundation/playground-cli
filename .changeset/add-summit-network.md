---
"playground-cli": patch
---

Add the Web3 Summit network to the env catalog. The active network is now selected by a single `ACTIVE_TESTNET_ENV` constant in `src/config.ts`, so pointing a release at Summit is a one-line change. The `deploy`, `deploy-all`, and `decentralize` commands now honour that constant as the `--env` default (previously hardcoded to `paseo-next-v2`) and accept `--env summit`; valid `--env` values are single-sourced in `config.ts` so they can't drift from the env list. A new `config.test.ts` guard keeps every env's endpoints in lockstep with polkadot-app-deploy's `environments.json` and blocks the switch until the target env's CDM meta-registry address exists. The CDM meta-registry address is resolved per-env from `@parity/cdm-env` (never hardcoded), the faucet URL is single-sourced in `config.ts`, and connection/funder error messages now name the active network instead of always saying "Paseo".
