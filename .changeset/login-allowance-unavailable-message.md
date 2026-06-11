---
"playground-cli": patch
---

Give `playground login` accurate guidance when a resource allowance can't be granted. A wallet that declines a request (`Rejected`) and one that cannot provision it at all (`NotAvailable`, e.g. an out-of-date mobile build) now produce different messages: the former still says to re-run and approve on your phone, while the latter tells you to make sure you're on the latest version of the app. Previously both were reported as a generic "denied ... approve on your phone", which sent users into a re-run loop that could never succeed.
