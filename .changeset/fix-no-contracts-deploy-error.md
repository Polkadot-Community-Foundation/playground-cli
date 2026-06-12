---
"playground-cli": patch
---

Fix a confusing `pg deploy` failure when the contract pre-step runs against a project with no contracts. Previously, requesting contract deploy (via `--contracts` or the TUI prompt) in a frontend-only project or from the wrong directory failed with the cryptic "No library specified and no dependencies found in cdm.json", surfaced in the TUI under a misleading "Signing Failed" banner. Deploy now reports an actionable error naming the directory and the likely cause, the standalone `pg contract install` error message points at the cdm.json it inspected, and non-signing contract failures are no longer mislabeled as signing failures.
