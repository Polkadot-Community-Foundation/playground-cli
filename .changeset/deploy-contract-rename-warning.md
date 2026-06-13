---
"playground-cli": patch
---

deploy: warn before redeploying contracts that CDM package names are owned by their first deployer. When you choose "yes, I changed contracts", `playground deploy` now shows an acknowledgement explaining that if the app is a mod (or you edited contracts someone else authored), the names in `cdm.json` belong to the original author and the deploy will fail unless you rename them first. Press Enter to continue or Esc to exit and rename.
