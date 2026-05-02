---
"playground-cli": patch
---

CI now posts a sticky E2E test-pass comment on every PR with per-test pass/fail counts and Sentry triage links. Nightly schedule failures auto-open a GitHub issue. Per-cell forensic logs (`dot-runs.log`) and JUnit XML are uploaded as workflow artefacts. Test traffic is tagged with `cli.tag:e2e-ci-{pr|nightly|dispatch}` so production Sentry dashboards can filter it out.
