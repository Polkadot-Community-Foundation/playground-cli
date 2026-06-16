---
"playground-cli": patch
---

install.sh now prints a shell-specific reload hint (`source ~/.zshrc` / `~/.bashrc` / fish config, or open a new terminal) on a fresh install, so users aren't left with a `playground`/`pg` command that isn't found until they manually reload their shell.
