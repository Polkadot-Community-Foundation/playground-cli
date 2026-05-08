---
"playground-cli": patch
---

Upgrade `bulletin-deploy` from `0.7.12` to `0.7.13`. The new release adds a `--env <id>` selector to the upstream CLI binary plus additive deploy span attributes (`deploy.env`, `deploy.network`, `deploy.environments_source`); library consumers see zero behaviour change and the default endpoint resolves to the same paseo-next WSS as before.
