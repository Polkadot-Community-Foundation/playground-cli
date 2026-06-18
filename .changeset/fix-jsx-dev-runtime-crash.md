---
"playground-cli": patch
---

Fix every UI-rendering command crashing with `jsx_dev_runtime.jsxDEV is not a function` (`--version`/`--help` were unaffected). The compiled binary's `--define process.env.NODE_ENV='"production"'` forced React's JSX runtime to its production build (which omits `jsxDEV`), while bun's bundler still emits `jsxDEV` calls — so every Ink render threw. Drop the define from all `bun build --compile` invocations (build, cli:install, and the three release workflows) so the runtime and the emitted JSX transform agree again.
