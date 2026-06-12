---
"playground-cli": patch
---

`install.sh` no longer shadows an existing `~/.profile` (or `~/.bash_login`) for bash users. The installer creates a `~/.bash_profile` bridge so the `~/.bashrc` PATH entry loads in login shells (every macOS terminal tab). Previously, creating that file from scratch silently took precedence over a pre-existing `~/.profile`/`~/.bash_login` — which login bash reads only as the first existing of `~/.bash_profile` → `~/.bash_login` → `~/.profile` — so the user's login-shell config stopped loading. When the installer now has to create `~/.bash_profile`, it first carries forward a sourcing line for the file bash would otherwise have read. An already-existing `~/.bash_profile` is left untouched apart from appending the `~/.bashrc` source line.
