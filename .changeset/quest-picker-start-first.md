---
"playground-cli": patch
---

Rework the `playground mod` quest picker so the start action is the first row ("START:" + the first unlocked level) and locked levels render greyed out below it, instead of a read-only level list with a separate Start button underneath. Enter now starts the tutorial immediately; removing cursor navigation also fixes rapid arrow keypresses getting lost.
