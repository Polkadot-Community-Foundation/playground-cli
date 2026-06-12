---
"playground-cli": patch
---

`deploy`: warn that the dev signer earns no XP before you pick it.

- The signer-choice screen now shows a yellow callout above the options, when phone signing is available, explaining that the dev signer publishes from a shared test account and so earns no XP, and that picking your phone signer publishes from your own account and earns XP.
- When you are not logged in, the existing "Mobile signing unavailable" notice now also mentions that logging in lets your deploys earn XP.
