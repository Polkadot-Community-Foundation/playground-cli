---
"playground-cli": patch
---

Build the compiled CLI binary with `process.env.NODE_ENV=production` so React ships in production mode. This removes the spurious React development warnings (e.g. "Cannot update a component while rendering a different component") that surfaced during `playground deploy`, and makes React faster and smaller in the shipped binary.
