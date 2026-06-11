---
"playground-cli": patch
---

Handle missing system prerequisites on clean Linux installs (#248): `playground init` now checks for `curl` and a C linker and installs them (via `apt`) before the steps that need them, `install.sh` fails fast with the exact remedy when `curl` is absent, and the README documents the Debian/Ubuntu prerequisite line (`build-essential curl`).
