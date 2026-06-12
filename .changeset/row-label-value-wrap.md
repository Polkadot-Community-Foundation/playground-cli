---
"playground-cli": patch
---

Long status-row messages no longer fuse into their label when they wrap (e.g. "deploy failedNo smart contracts…"). The label and value now live in separate flex boxes so a wrapping value can't swallow the label's trailing space.
