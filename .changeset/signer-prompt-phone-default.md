---
"playground-cli": patch
---

Sync the `playground decentralize` prompts with `playground deploy`:

- The signer pickers in both commands list your phone signer first and start the cursor on it (when logged in). The "dev signer earns no XP" warning now appears below the options, only while the dev signer is highlighted, and disappears when you move back to the phone signer.
- `playground decentralize` now shows the same magenta help boxes as deploy above its signer, domain, publish, and (new) tags prompts, and its intro box uses the same accent style.
- The "publish to the playground registry?" prompt now lists "yes" first and selects it by default.
- `playground decentralize` gained a category-tag step and a `--tag` flag (whitelisted to the playground tags, requires `--playground`), matching deploy; the chosen tag is written to the published app metadata and shown in the confirm summary.
