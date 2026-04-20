---
"playground-cli": minor
---

`dot build` (and the build phase of `dot deploy`) now auto-installs the project's dependencies when `node_modules/` is missing. The package manager is inferred from the lockfile (`pnpm`/`yarn`/`bun`), falling back to `npm`. Previously, an uninstalled project fell through to `npx <framework> build`, which ephemerally downloaded the framework binary but then failed with a confusing `ERR_MODULE_NOT_FOUND` while loading the project's own config file (e.g. `vite.config.ts` importing `vite`).
