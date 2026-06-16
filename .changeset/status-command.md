---
"playground-cli": minor
---

Add `playground status`: show your signed-in product account (SS58 + H160), native and PGAS balances, Bulletin authorization validity (with a time estimate), and how recently you paired your phone — all read-only, with no phone interaction.

Fix the native token decimal scale: PAS/SUM are 10 decimals (verified live against the chain), not 12. This corrects every balance display (amounts were under-shown 100x) and makes `playground drip` transfer the documented 1 PAS per run (10 PAS cap) instead of 100 PAS (1000 PAS cap). PGAS is shown at the same 10-decimal scale.
