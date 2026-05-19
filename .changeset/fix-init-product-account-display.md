---
"playground-cli": patch
---

Fix `dot init` so the product account row shows the actual signer account used by deploy, make Bulletin allowance setup tolerate delayed authorization propagation without skipping product-account funding, detect cached Bulletin allowance keys that are not authorized on-chain, and let `dot logout` recover from stale sessions missing the product-derivation root key.
