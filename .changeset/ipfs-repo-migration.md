---
"playground-cli": patch
---

Handle the IPFS "repo needs migration" failure during deploys.

- `playground login` now detects a stale local Kubo repo (older on-disk format than the installed `ipfs` binary) and runs the one-time `ipfs repo migrate` as part of setup, so deploys don't later crash inside `ipfs add`.
- When a deploy still hits the migration error (e.g. the IPFS binary was upgraded after login), the cryptic `Command failed: ipfs add … repo needs migration` is replaced with a clear instruction to run `ipfs repo migrate` or re-run `playground login`.
