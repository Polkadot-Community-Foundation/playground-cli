---
"playground-cli": patch
---

`playground deploy --no-build` now validates the build directory up front. A missing or mistyped `--buildDir` fails immediately with an actionable message (`Build directory not found: …`) before the availability check, summary, and any on-chain work, instead of surfacing late as an opaque `Path not found` inside the storage phase.

The build directory is now resolved against `--dir` (the project root) for the storage upload as well, so deploys run with `--dir` pointing outside the current working directory upload the directory the build actually wrote to.
