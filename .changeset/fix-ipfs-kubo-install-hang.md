---
"playground-cli": patch
---

Fix `playground login` hanging during the IPFS (Kubo) install step. The installer now runs `install.sh` without sudo first (falling through to `~/.local/bin`) and uses `sudo -n` as a fallback so it no longer blocks on a sudo password prompt.
