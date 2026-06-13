---
"playground-cli": patch
---

`playground login` no longer prints a "Statement subscription error: … Not connected" stack trace after a successful sign-in. When the login adapter is destroyed, an in-flight statement-store subscription can surface a bare `Error: Not connected` from the just-closed websocket. That benign teardown artifact was already swallowed as an unhandled rejection, but the statement-store package also logs it directly from its subscription error callback; the local patch that silences that log now matches the bare "Not connected" shape in addition to `DestroyedError`, mirroring `isBenignUnsubscriptionError`.
