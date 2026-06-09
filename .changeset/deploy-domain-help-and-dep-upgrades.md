---
"playground-cli": patch
---

Add an info box to the `playground deploy` domain prompt explaining how name length maps
to the Proof-of-Personhood requirement: a name with a 9-character-or-longer base is open
to everyone and deploys with no personhood check, names of 6 to 8 characters need Proof of
Personhood, and names of 5 or fewer are reserved. The validation rules themselves are
unchanged (a digit suffix must still be exactly two digits).

Upgrade dependencies to latest: `bulletin-deploy` 0.9.0 → 0.10.0, `@parity/product-sdk-terminal`
0.3.2 → 0.4.0, `@parity/product-sdk-descriptors`/`-cloud-storage` 0.5 → 0.6 (brings in the Summit
Network env/descriptors ahead of wiring that chain into `CONFIGS`), the
`@parity/product-sdk-contracts`/`-keys`/`-tx` patch releases, `@parity/dotns-cli` 0.6.1 → 0.6.6,
and refreshed `@parity/cdm-*` lockfile entries. host-papp/host-api stay on the 0.8.6 mobile-pairing
line (the only newer release is an 0.8.7 prerelease that would force a no-migration re-pairing).
The descriptors 0.6.0 bump introduces a nominal `DotnsGateway` type-skew against `cdm-builder`,
bridged with a cast seam in `contract.ts` (the contract pipeline never touches that pallet).
