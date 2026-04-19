---
"playground-cli": patch
---

Suppress the cosmetic `UnsubscriptionError: Not connected` stack trace that appeared during `dot deploy`'s domain-availability check. It came from polkadot-api tearing down its chainHead follow subscription after `dotns.disconnect()` had already closed the WebSocket — expected, benign, and surfaced as either an `unhandledRejection` or `uncaughtException` depending on the runtime. The process now filters that specific rxjs error (UnsubscriptionError whose inner errors are all "Not connected") instead of logging a 40-line stack trace and tearing the deploy down. Unrelated rejections and exceptions still escalate as before; run with `DOT_DEPLOY_VERBOSE=1` to get a one-line note when a filter fires. Also adds a Troubleshooting section to the README pointing users at `DOT_MEMORY_TRACE=1` + `DOT_DEPLOY_VERBOSE=1` for memory / OOM bug reports.
