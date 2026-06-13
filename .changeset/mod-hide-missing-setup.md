---
"playground-cli": patch
---

`playground mod`: stop showing a warning when an app has no `setup.sh`. Apps without a setup script are the common case, and surfacing it as a yellow warning row alarmed users. The step is now skipped silently and the usual "Next steps" footer is printed as before.
