---
"playground-cli": patch
---

`playground mod` now always prints the "Next steps" footer for a successful mod. It was previously hidden whenever the app shipped a `setup.sh`, which left apps whose setup script does not print its own next-steps guidance (e.g. the tutorial app) with no footer at all.
