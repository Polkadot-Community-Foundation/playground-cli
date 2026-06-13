---
"playground-cli": patch
---

Distinguish a wrong working directory from a genuinely unrecognised project in `dot build` / `dot deploy`. When no `package.json` is found, the error now points at the current directory ("Are you in your project directory? cd into it first, or point the command at it with --dir <path>.") instead of the misleading "No build strategy detected" message that suggested editing a package.json that isn't there.
