---
"playground-cli": patch
---

`playground mod` now shows a community-code notice before downloading an app: a callout above the interactive picker list, and the same notice on the setup screen for the direct `playground mod <domain>` path. It tells users that apps are community-published open source, not reviewed, and that modding runs the app's setup script on their machine. Also, the moddable prompt in `playground deploy` now defaults its cursor to yes.
