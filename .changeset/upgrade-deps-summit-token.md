---
"playground-cli": minor
---

Upgrade the product-sdk / triangle-js-sdks / DotNS dependency stack and add the
Summit network token symbol.

- **`@parity/product-sdk-terminal` `^0.4.0` → `^0.5.0`**, which pulls the
  `@novasamatech/*` host stack (host-papp, statement-store, host-api, …) from
  `0.8.6` to `0.8.7`. Also bumps the within-caret product-sdk floors
  (`contracts` `0.7.4`, `cloud-storage` `0.6.1`, `descriptors` `0.6.1`, `keys`
  `0.3.7`, `tx` `0.2.11`) and `@parity/dotns-cli` `0.6.6` → `0.6.8`.
- **You will need to re-pair your phone once after this upgrade.** host-papp
  0.8.7 renamed the on-disk session storage key (`SsoSessionsV2` →
  `SsoSessionsV3`) and added a required field to the persisted session; there is
  no migration, so existing pairings are invisible until you run `playground
  login` again. Cached allowance slot keys are unaffected.
- **New `SUM` token symbol for the Summit network.** Token amounts (balances,
  `playground drip`) now read the active env's symbol, so flipping the network to
  Summit relabels every amount from `PAS` to `SUM` automatically.
