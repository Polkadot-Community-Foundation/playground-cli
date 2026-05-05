---
"playground-cli": minor
---

Every `dot` invocation now shows a one-line "Update available" banner at the bottom when a newer release exists. The check resolves the latest version through jsDelivr's free public CDN (not GitHub's rate-limited API) with a 1 s timeout, so a flaky network never delays the command. Suppressed in CI / piped output, when running `dot update` itself, and when `DOT_NO_UPDATE_CHECK=1`.

`dot mod` and `dot deploy --modable` now opportunistically pass an `Authorization: Bearer <token>` header read from `gh auth token` when available — logged-in users get GitHub's per-user 5000/hour quota instead of contributing to the shared 60/hour anonymous-IP quota that gets exhausted quickly on hackathon WiFi. Anonymous users continue to work as before.

`dot deploy --modable` now fails with an explicit "GitHub rate limit exceeded — run `gh auth login`" error when the public-repo preflight is denied by the rate limiter, instead of silently passing the check and risking a private repo being published as modable. Ambiguous 403s and transient 5xx responses still skip the check (unchanged).

`dot init` ends with an explicit advisory banner (visually consistent with the new "Update available" banner) explaining the IP-based GitHub rate limit and recommending `gh auth login`, but only when the user is not currently authed. The single-row dependency-list warning was too terse to convey why this matters on hackathon / shared-network setups.
