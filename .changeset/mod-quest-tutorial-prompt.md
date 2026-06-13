---
"playground-cli": patch
---

`playground mod` now nudges users toward the guided tutorial: when a quest track is started from the picker, the post-clone "Next steps" hint reads `edit with claude (prompt: "start tutorial")` instead of the plain `edit with claude`. The quest and app pickers also tear down their Ink instance fully before the next screen mounts, so a half-unmounted picker can no longer swallow the following screen's keystrokes or leave a stale frame on top of it.
