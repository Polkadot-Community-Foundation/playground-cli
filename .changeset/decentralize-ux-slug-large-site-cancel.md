---
"playground-cli": patch
---

`decentralize`: explain the auto-generated domain suffix, warn on large sites, and document cancel.

- Auto-generated free `.dot` names (e.g. `dominique-io-urcn30`) now show an inline note explaining the random suffix lets anyone register the name without a proof-of-personhood credential — it was previously unexplained and read as a bug.
- Mirroring a large site now surfaces a "large site — this may take several minutes" warning once the download crosses 200 files, in both the interactive TUI and headless output.
- The TUI and headless output now document that Ctrl+C cancels at any time.
