---
"playground-cli": patch
---

Surface Bulletin allowance approvals in the deploy TUI and drop the guessed step total from phone-approval prompts.

- `playground deploy` and `playground decentralise` now show a "check your phone" callout when an RFC-0010 Bulletin allowance request (first-use grant or quota top-up) is waiting on the phone. Previously these requests rode the statement store outside the signing proxy, so the phone showed an approval dialog while the terminal sat silent.
- Phone approval prompts now read "approve step 1", "approve step 2", … instead of "step N of M". The predicted total regularly drifted from what actually ran (e.g. a planned PoP upgrade the runtime skipped left users on "step 4 of 5" with no fifth step), and allowance taps are demand-driven so they can never be counted up front. The pre-deploy summary now labels its count as "expected" and notes that an extra Bulletin allowance approval may appear.
