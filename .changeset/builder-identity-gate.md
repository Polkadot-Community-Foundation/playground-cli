---
"playground-cli": minor
---

Gate `mod`, `init`, `deploy`, `decentralize`, and `deploy-all` behind a revealed
builder identity. These commands now require you to be signed in (`playground
login`) and to have joined the competition at playground.dot in your desktop
app — the CLI reads your product account's on-chain identity binding from the
playground registry (via the keyless read-only origin, no phone tap) and refuses
to act for anonymous accounts. When you haven't joined yet, the command prints a
friendly yellow notice explaining how to become a builder and exits without
error. The check is signer-mode-agnostic: dev and `--suri` runs are gated too,
but once you've revealed yourself they work as before.
