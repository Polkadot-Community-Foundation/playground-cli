---
"playground-cli": patch
---

deploy: the "Moddable Setup Needed" screen is no longer a dead end. When the source check fails (for example, no GitHub origin is configured), the deploy now offers "continue without moddable", "go back" (re-answer the remix question, which retries the check), and a clean exit, instead of forcing the whole deploy to abort. The interactive message also no longer references CLI flags.
