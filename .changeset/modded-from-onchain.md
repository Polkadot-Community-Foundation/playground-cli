---
"playground-cli": patch
---

Fix `dot deploy --playground` not recording mod lineage on-chain. The
`modded_from` argument to the registry `publish()` call was read from a
never-set option instead of the `moddedFrom` value `dot mod` captures in
`dot.json`, so the contract always received `""` and never awarded the source
owner the "your app is modded" XP. The deploy now passes the captured source
domain through to the registry.
