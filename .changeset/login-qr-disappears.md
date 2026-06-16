---
"playground-cli": patch
---

`playground login` now clears the pairing QR code from the screen once the phone scans it and finishes signing in, leaving a clean logged-in summary. Previously the QR stayed on screen for the rest of setup; it is no longer rendered inside the live UI region (which could also cause it to duplicate on shorter terminals).
