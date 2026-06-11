---
"playground-cli": patch
---

Remove the Bulletin storage quota check and the per-deploy "Increase allowance" phone tap. The Bulletin `store` extrinsic treats the tx/byte allowance counters as soft limits — the chain only requires that an authorization exists and has not expired — so a quota-exhausted-but-valid slot uploads fine. Deploy and login now verify existence + non-expiry only, removing an approval many users hit unnecessarily.
