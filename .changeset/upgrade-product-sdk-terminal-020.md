---
"playground-cli": patch
---

Upgrade `@parity/product-sdk-terminal` to `^0.2.0` and the rest of `@parity/product-sdk-*` to their latest patch releases. The new terminal release includes both fixes the CLI was working around: (1) `createSessionSignerForAccount` now uses a split-callback PJS signer (tx → `session.signPayload`, bytes → `session.signRaw`), so the local PJS-based replacement we'd inlined is gone; (2) `destroy()` is now async and drains pending statement-subscription unsubscribes before tearing down the lazy client, eliminating the `DestroyedError: Client destroyed` unhandled rejection on `dot logout`. The CLI's local helpers and the `DestroyedError` entry in `isBenignUnsubscriptionError` are removed accordingly.
