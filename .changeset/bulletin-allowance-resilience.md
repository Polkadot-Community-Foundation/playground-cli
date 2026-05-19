---
"playground-cli": patch
---

Make `dot init` survive Bulletin allowance propagation lag, and fix a React setState warning that landed in the previous account-derivation PR.

- **`dot init` no longer aborts** when the RFC-0010 Bulletin slot account is returned by mobile but the on-chain authorization hasn't propagated to Bulletin Chain yet. The slot key + marker are persisted regardless (so the next `dot deploy` picks them up), and the funding/mapping step continues to run. The row shows a soft-failure warning with the slot account SS58 and a faucet URL.
- New `BULLETIN_AUTHORIZATION_URL` + `bulletinAuthorizationHelp(slotAddress)` so timeout / cached-key-not-authorized errors point at `https://paritytech.github.io/polkadot-bulletin-chain/authorizations` with the exact slot SS58 to authorize manually.
- `requestAndStoreBulletinAllowanceSigner` persists the slot key before waiting for chain confirmation. A propagation timeout no longer discards a valid key the mobile already derived.
- `storeSlotAccountKeysFromOutcomes` is now a single read-modify-write so two slot keys returned in one call (e.g. BulletInAllowance + StatementStoreAllowance) can't race-clobber each other in `allowance-keys.json`.
- Fix a "Cannot update a component while rendering a different component" warning from `QrLogin`: it was calling the parent's `onDone(setState)` from inside `setStatus(updater)`. The handler now captures the resolved addresses in a `useRef` and calls `onDone` after the promise resolves, outside any updater function.
