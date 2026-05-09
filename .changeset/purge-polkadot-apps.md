---
"playground-cli": patch
---

Purge `@polkadot-apps/*` from the dependency tree. `@dotdm/contracts` is pinned to `1.1.1-dev.1778274929` (the dev release from the CDM monorepo's product-sdk migration PR; the `latest` stable still pulls the legacy stack), and `@novasamatech/*` is forced to `0.7.8-2` via `pnpm.overrides` so transitive consumers come along. `grep '@polkadot-apps/' pnpm-lock.yaml` now returns zero hits. The runtime is effectively PAPI 2.x-only — the lockfile still mentions `polkadot-api@1.23.3` but only as a vestigial declaration of the bundled `@parity/dotns-cli` CLI binary, which inlines its deps and never resolves them at runtime.
