---
"playground-cli": patch
---

deploy: the "Moddable Setup Needed" screen is no longer a dead end. When the source check fails (for example, no GitHub origin is configured), the deploy now offers "continue without moddable" and a clean exit (exit 0 with a friendly nudge), instead of forcing the whole deploy to abort with an error. The interactive message also no longer references CLI flags.
