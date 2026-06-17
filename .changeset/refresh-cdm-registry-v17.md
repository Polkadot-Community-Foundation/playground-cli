---
"playground-cli": patch
---

Refresh the `@w3s/playground-registry` snapshot in `cdm.json` to v17. The registry contract was redeployed at a new address (`0x4a32e0FB190112F169308Ebc8aC5A4e624263035`), so contract deploys and playground publishes now target the current contract. The v17 ABI drops the unused `rateApp`, `removeRating`, `getContextId`, and `refreshReputationReference` functions.
