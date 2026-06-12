---
"playground-cli": patch
---

`pg mod` now checks that a project's `setup.sh` can find a JavaScript package manager (npm, pnpm, or bun) before running it. If the script references package managers but none of them are installed, setup stops early with a clear message instead of failing partway through with an opaque error. Scripts that fall back across managers (try bun, else pnpm, else npm) pass as long as any one is installed.
