# Deploying playground-cli to a new network (Summit)

`playground-cli` is a published binary, not a hosted service — targeting Summit means cutting a release built against Summit's endpoints. The switch is one constant (`ACTIVE_TESTNET_ENV` in `src/config.ts`) plus one dependency bump. A CI gate (`src/config.test.ts`) blocks the switch until Summit is actually ready, so `pnpm test` — not a runtime error — tells you if a prerequisite is missing.

This doc runs **after** `polkadot-app-deploy`'s [`DEPLOYMENT.md`](https://github.com/paritytech/polkadot-app-deploy/blob/main/DEPLOYMENT.md), which brings up Summit's chains, DotNS contracts, Bulletin storage authorization, and account funding. The CLI reuses those accounts, so it adds no account setup of its own.

## Prerequisites

- Node 22.x   (check: `node --version`)
- pnpm 11.x   (check: `pnpm --version`)
- `gh` CLI, authenticated   (check: `gh auth status`)
- `polkadot-app-deploy`'s `DEPLOYMENT.md` completed for Summit (chains, DotNS, authorization, funding).
- The CDM meta-registry deployed on Summit and its address published in a `@parity/cdm-env` release. This is done by the Contract Dependency Manager's [`DEPLOY_DOC.md`](https://github.com/paritytech/contract-dependency-manager/blob/main/DEPLOY_DOC.md) (deploy the registry → publish its address in a new cdm-env release under the `w3s` key). You don't pin a cdm-env version — you take the latest and let the check in step 2a confirm it. This is the hard gate.

## 1. Get the code

```bash
git clone https://github.com/paritytech/playground-cli.git
cd playground-cli
git checkout main
pnpm install --frozen-lockfile
```

## 2. Configure (the switch)

Three edits — never inline a Summit URL or address anywhere else. Summit's endpoints are already wired in the `SUMMIT` block of `src/config.ts`; you don't touch them — `pnpm test` (§4) enforces that they match `polkadot-app-deploy`'s catalog.

**a.** Bump `@parity/cdm-env` to the latest release and confirm it ships the Summit (`w3s`) registry address:

```bash
pnpm add @parity/cdm-env@latest
node --input-type=module -e "import {getRegistryAddress} from '@parity/cdm-env'; console.log(getRegistryAddress('w3s') || '(empty)')"
```

Expected: a `0x…` address. If it prints `(empty)`, the CDM `DEPLOY_DOC.md` isn't complete yet — stop here, the switch can't ship.

**b.** Flip the network switch in `src/config.ts`:

Update `ACTIVE_TESTNET_ENV`: `"paseo-next-v2"` -> `"summit"`.

```ts
export const ACTIVE_TESTNET_ENV: Env = "summit";   // was "paseo-next-v2"
```

**c.** In the `SUMMIT` block in `src/config.ts`, set `faucetUrl` to Summit's faucet, or leave it `null` if Summit has no public faucet (the CLI just omits the faucet link).

## 3. Release

```bash
git checkout -b switch/default-env-summit
pnpm changeset            # "playground-cli": minor — "Switch default network to Summit"
git add src/config.ts package.json pnpm-lock.yaml .changeset/
git commit -m "feat: switch default network to summit"
git push -u origin switch/default-env-summit
gh pr create --fill
```

Merging to `main` with a changeset triggers the release workflow. Without a changeset it's a no-op.

## 4. Verify

```bash
pnpm format:check
pnpm lint:license
pnpm typecheck
pnpm test          # config.test.ts is the gate: Summit endpoints match the deploy
                   # engine AND getRegistryAddress("w3s") is non-empty
```

After the release publishes, confirm the binary points at Summit:

```bash
playground login   # pairs the mobile app and maps the account on Summit
```

## Troubleshooting

| You see | Fix |
|---|---|
| `pnpm test` fails on `default env has a non-empty CDM meta-registry address` | The `@parity/cdm-env` version you bumped to still returns `""` for `w3s`. The registry isn't published yet — do not flip the default. |
| `pnpm test` fails on `… endpoint matches upstream` / `network matches upstream` | The `SUMMIT` block in `src/config.ts` drifted from `polkadot-app-deploy`'s `assets/environments.json`. Bump `@parity/polkadot-app-deploy` and re-sync the block — they must stay byte-identical. |
| Summit endpoints look unreachable | Run RPC reachability from a clone of `polkadot-app-deploy` (it's a `polkadot-app-deploy` diagnostic, not in this repo): `node tools/probe-env-health.mjs --env summit`. |
