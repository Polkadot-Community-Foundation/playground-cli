---
"playground-cli": patch
---

When a mistyped command or option is too far off for commander's built-in "Did you mean …?" suggestion, the error now tails with a pointer to `playground --help` (matching git's behavior). Covers the root program and every subcommand, including option typos on `login`, `deploy`, etc.
