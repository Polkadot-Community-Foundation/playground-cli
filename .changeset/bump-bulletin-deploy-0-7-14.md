---
"playground-cli": patch
---

Bump `bulletin-deploy` to `0.7.14`. Internal hardening of the chunked-storage path against WS-halt allocation storms: per-deploy retry-budget circuit breaker, recovery batch-size drop (2→1 in flight after first reconnect), and a synchronous WS-close hook that destroys the PAPI client before its broadcast-replay loop can OOM. No public-API changes.
