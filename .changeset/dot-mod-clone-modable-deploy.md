---
"playground-cli": minor
---

`dot mod` now downloads source as a fresh project from GitHub via HTTPS — multiple mods of the same starter no longer collide via GitHub's one-fork-per-account limit. `git` and `gh` are no longer required to mod an app.

`dot deploy --playground` now asks before publishing source. Pass `--modable` (or answer "yes" to the prompt) to publish a public GitHub source repo alongside the deploy so others can `dot mod` it. Use `--no-modable` to skip the prompt non-interactively. The default is non-modable. Pass `--repo-name <name>` to skip the repo-name prompt when creating a fresh repo.

The interactive registry picker (`dot mod` with no domain) now hides apps that aren't modable.

Removed: `dot mod --clone`, `--repo-name`, `--yes` flags (no longer needed).
