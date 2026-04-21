---
"playground-cli": patch
---

Fix `dot deploy` crashing on Bun-compiled binaries with `node:v8 getHeapSpaceStatistics is not yet implemented in Bun.` when running from an internal Parity repo. Move the `bulletin-deploy` telemetry opt-out into a dedicated `src/bootstrap.ts` side-effect module imported before any other module, and additionally force `BULLETIN_DEPLOY_MEM_REPORT=0` so bulletin-deploy's diagnostic memory-report path can never reach Bun's unimplemented `v8.getHeapSpaceStatistics`. Explicit `BULLETIN_DEPLOY_TELEMETRY=1` / `BULLETIN_DEPLOY_MEM_REPORT=1` overrides are preserved.
