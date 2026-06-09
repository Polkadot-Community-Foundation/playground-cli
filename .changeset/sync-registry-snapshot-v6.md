---
"playground-cli": patch
---

Refresh the bundled `@w3s/playground-registry` contract manifest from the CDM meta-registry, syncing the committed `cdm.json` snapshot to the current on-chain deployment (generation 6, `0x82db2A7013ee5bDC69e12CC998dDb3A3eca1Ce4F`). The ABI is byte-identical to the previous generation and the CLI already resolves the registry address live from the meta-registry at runtime, so this is a snapshot-honesty update with no behavioral change.
