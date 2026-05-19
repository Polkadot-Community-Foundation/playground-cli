---
"playground-cli": patch
---

Fix the `dot init` identity block:

- Stop double-deriving the product account. The "product account" line previously ran `deriveProductAccountPublicKey` on the already-product-derived SS58, producing a ghost address whose SS58 + H160 didn't match what the playground-app actually uses. Both are now taken straight off the auth-derived pubkey via a shared `derivePlaygroundProductPublicKey` helper, so the signer that signs on-chain and the display the user sees can no longer drift.
- Show the SSO wallet root on the "logged in" line instead of the product account. The product account is on its own row underneath with the full SS58 + H160. The root is also what the username lookup is keyed on.
- Fix the username lookup key. Usernames live at `Resources.Consumers[<rootAccountId>]` on the People parachain; the lookup was previously running against the product account and would never find a match. It now uses the wallet root, matching polkadot-desktop's `useSessionIdentity`.
