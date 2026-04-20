---
"playground-cli": patch
---

Fix `dot deploy` reporting "already registered" on re-deploys made in dev mode when a phone session was also present.

The domain-availability preflight was passing the logged-in user's SS58 address as the reference owner for the on-chain ownership check regardless of signer mode. In dev mode bulletin-deploy signs DotNS with its built-in `DEFAULT_MNEMONIC`, so the domain is owned by the dev account — not the user — and the preflight incorrectly reported the re-deploy as taken by a different account. We now only pass the user's address when `--signer phone` (where bulletin-deploy actually uses the user's signer). In dev mode we skip the ownership check and let bulletin-deploy's own preflight classify the re-deploy with the right signer.
