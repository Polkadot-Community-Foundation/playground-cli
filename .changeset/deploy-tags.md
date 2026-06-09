---
"playground-cli": minor
---

`playground deploy` can now tag a published app so people can filter for it in the playground. When publishing to the playground, the interactive flow asks you to pick one of the predefined tags (social, chat, defi, utility, gaming, marketplace, irl) or skip. Headless deploys accept `--tag <tag>` (requires `--playground`). The tag is written to the app's metadata as `tag`, which the playground-app filter reads.
