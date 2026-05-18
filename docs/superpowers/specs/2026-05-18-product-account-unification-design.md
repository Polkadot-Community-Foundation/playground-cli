# Product-account unification across playground-cli, playground-app, and product-sdk

**Status:** Draft, pending user approval
**Author:** utkarsh.bhardwaj@parity.io
**Created:** 2026-05-18

## Problem

The `playground-cli`, the `playground-app` web UI, and the underlying Polkadot hosts (mobile, desktop, dotli) each derive a "product account": the per-product public key the user signs with when interacting with `playground.dot`. Today this derivation is implemented in three places (CLI, desktop, mobile), and a fourth, *misleadingly named* utility lives in `product-sdk` using a completely different algorithm. There is no single source of truth, no fixture proving the implementations agree, and no on-screen confirmation in `dot init` that lets a user verify their CLI is acting as the same account that `playground-app` sees.

This spec consolidates derivation in `@parity/product-sdk-keys`, locks it against a canonical fixture, surfaces the result in `dot init`, deprecates the misleading SDK util, and captures the deferred "CLI as host" option as a roadmap note.

## Goals

1. **One canonical implementation** of `deriveProductAccountPublicKey(parentPublicKey, productId, derivationIndex)`, living in `@parity/product-sdk-keys`. CLI imports it; no other consumer reimplements it.
2. **Algorithmic equivalence with the desktop host** locked by frozen vitest fixtures in product-sdk. Drift fails CI before it reaches consumers.
3. **`dot init` shows the user's root username (on-chain) and product account address (SS58 + H160)**, so the user can eyeball-confirm their CLI account matches what `playground-app` displays under "My apps."
4. **Rename the misleading `deriveProductAccount` in `@parity/product-sdk/identity`** (a blake2b util that is NOT the canonical product-account derivation) to a name reflecting its actual purpose. Hard rename, consistent across the product-sdk repo, no deprecation alias.
5. **Capture the "CLI as a host" option as a deferred roadmap note** with a written reason and a trigger for revisiting.

## Non-goals

- Making the CLI a host in the host-api sense (`host-container`-based). Deferred; rationale in the roadmap note (Section 5).
- Generating a CLI-only root mnemonic. Would defeat the shared-identity goal and is explicitly out of scope.
- Adding sr25519 *keypair* derivation (private + public) to `product-sdk-keys`. Only the public-key path is in scope. Private keys never leave the user's mobile under the current trust model.
- Refactoring `sessionSigner.ts` to use `@parity/product-sdk-signer`'s `SignerManager`. Half-measure; not needed without becoming a host.
- Touching `deriveAnonymousAlias`, `createRingProof`, `verifyRingProof` in `product-sdk/identity`. Unrelated to the misleading-name issue.

## Background

### How the four hosts derive product accounts today

| Source | File | Algorithm | Input |
|---|---|---|---|
| Mobile (Android) | `polkadot-app-android-v2/feature/products/impl/.../ProductAccountDerivationUseCase.kt:56-58` | sr25519 soft derivation, path `"/product/{productId}/{derivationIndex}"` | bare-mnemonic seed |
| Desktop (Electron) | `polkadot-desktop/src/domains/product/account/service.ts:8-27` | sr25519 soft derivation, junctions `['product', productId, String(derivationIndex)]`, u64 numeric encoding, blake2b fallback for >32-byte chain codes | root public key |
| Dotli (web) | `dotli/packages/auth/src/account.ts` (per agent research) | sr25519 soft derivation | root public key (paired with mobile via QR, same trust model as CLI) |
| CLI | `playground-cli/src/utils/productAccountDerivation.ts:76-86` | sr25519 soft derivation, junctions `['product', productId, String(derivationIndex)]`, u32 numeric encoding, throws on >32-byte chain codes | root public key from `session.rootAccountId` |

### Algorithmic equivalence (today)

By code reading, the CLI and desktop produce **byte-identical** chain codes for every junction in our production input range:

- Junction `'product'`: SCALE-encoded as 9 bytes (compact-length 1 byte + 7 utf8 bytes), zero-padded to 32. **Identical** between CLI and desktop.
- Junction `'playground.dot'`: SCALE-encoded as 15 bytes, zero-padded to 32. **Identical**.
- Junction `'0'`: CLI emits `u32.enc(0)` (4 zero bytes) padded to 32 zero bytes. Desktop emits `u64.enc(0n)` (8 zero bytes) padded to 32 zero bytes. **Identical at the chain-code level.** For any index `< 2^32`, the LE encoding agrees on the prefix bytes and the trailing bytes are zeros in both.

Therefore: **CLI and desktop produce the same 32-byte product-account public key for `(rootPubKey, "playground.dot", 0)` today.** The same conclusion holds against mobile by virtue of sr25519 soft derivation being a standard with identical junction parsing. Cross-verification of mobile by Kotlin testing is out of scope here but flagged as an optional follow-up.

The CLI's `u32` choice for the numeric branch is functionally equivalent to desktop's `u64` for any index < 2^32. We adopt `u64` in `product-sdk-keys` to match desktop byte-for-byte, eliminating any future ambiguity.

### Why we cannot call the host-api from the CLI

The `host-api` is a wire protocol over a `postMessage` channel between a product (running inside a webview/iframe) and a host (the mobile/desktop wallet). The CLI is a standalone Node/Bun process with no parent webview or `MessagePort`, so it is on neither end of the channel. The only existing CLI-to-mobile transport is `@parity/product-sdk-terminal`'s SSO/QR flow (statement-store messages, a different protocol). For derivation specifically, no host call is necessary: it is a pure function of `(rootPubKey, productId, index)`, and the CLI already has the root pubkey via `session.rootAccountId`.

### Why we are not making the CLI a host (yet)

`@novasamatech/host-container` is environment-agnostic at its core and could run inside a Node/Bun CLI process. The closest reference is `dotli`, which proxies the user's session to mobile via QR pairing (the same trust model the CLI already uses). However, becoming a host means implementing ~40 handler callbacks, a Provider transport, file-backed storage, and Ink consent prompts (roughly 2-3 weeks of work) **without any product to actually host inside the CLI process today.** The CLI is currently the product side of the host-product split. Until a `dot run X` workflow exists or a second tool wants host-api shaped abstractions in the CLI, becoming a host is speculative scaffolding. Captured as a roadmap note (Section 5).

## Design

### Section 1: add canonical derivation to `@parity/product-sdk-keys`

**New file:** `product-sdk/packages/keys/src/productAccount.ts`.

**Exports:**

```ts
export function createChainCode(code: string): Uint8Array;

export function deriveProductAccountPublicKey(
    parentPublicKey: Uint8Array,
    productId: string,
    derivationIndex: number,
): Uint8Array;
```

**Algorithm.** Sr25519 soft derivation with junctions `['product', productId, String(derivationIndex)]`, applied left-to-right to `parentPublicKey`. For each junction:

- if `code` matches `/^\d+$/`: encode as SCALE `u64` (BigInt), matching desktop byte-for-byte.
- else: encode as SCALE `str` (compact-length + UTF-8 bytes).
- if the encoded form is ≤ 32 bytes: zero-pad to 32 bytes.
- if the encoded form > 32 bytes: `blake2b(encoded, { dkLen: 32 })`.

**Dependencies.** `@scure/sr25519` (`HDKD.publicSoft`), `@noble/hashes/blake2.js` (`blake2b`), `scale-ts` (`u64`, `str`). All already present in product-sdk; no new third-party deps.

**Index re-export.** `product-sdk/packages/keys/src/index.ts` adds:

```ts
export { deriveProductAccountPublicKey, createChainCode } from "./productAccount.js";
```

**JSDoc header.** Block-comment establishing this as the canonical implementation, with citations to the desktop and mobile mirrors. Notes that the function works on the parent *public* key alone (no secret key required for derivation) because sr25519 soft derivation is composable on public keys.

### Section 2: CLI imports from product-sdk-keys

**Deletions in playground-cli:**

- `src/utils/productAccountDerivation.ts`: entire file removed.
- Any local `*.test.ts` adjacent to the deleted file: removed (canonical tests live in product-sdk).

**Import swaps:**

- `src/utils/sessionSigner.ts:115-119`: change to `import { deriveProductAccountPublicKey } from "@parity/product-sdk-keys";`. Function body unchanged.
- Any other callsite of `deriveProductAccountPublicKey` in `src/`: swept and updated.

**Package.json bump.** Bump `@parity/product-sdk-keys` to the version that ships the new export. Caret-range respected per existing CLAUDE.md guidance.

**Rollout sequence.**

1. PR 1 (product-sdk repo): ship `deriveProductAccountPublicKey` + `createChainCode` in `@parity/product-sdk-keys`. Publish a new minor version.
2. PR 2 (playground-cli repo): bump dep to that version, delete `productAccountDerivation.ts`, swap imports.
3. Both PRs verify `pnpm test && pnpm build && pnpm format:check && pnpm lint:license` per CLAUDE.md.

**Risk: derivation drift on non-zero indices.** The CLI uses `u32` today; product-sdk-keys ships `u64`. Outputs agree byte-for-byte for any index < 2^32, and we always use index 0. Confirmed during implementation by sweeping for non-zero `derivationIndex` callsites before merging.

### Section 3: verification fixtures (four layers)

**Layer A: frozen vectors in `product-sdk-keys`.** New file `product-sdk/packages/keys/src/productAccount.test.ts` with four `(rootPublicKey, productId, derivationIndex) → expected publicKey hex` cases:

1. `root = 0x00…` (32 zero bytes), `productId = "playground.dot"`, `index = 0`: production case.
2. `root = 0x01…` (32 0x01 bytes), `productId = "playground.dot"`, `index = 1`: exercises non-zero u64 numeric branch.
3. `root = 0x…`, `productId = "a-very-long-product.dot"`, `index = 0`: near-32-byte-boundary, no fallback.
4. `root = 0x…`, `productId = "this-name-is-deliberately-long-enough-to-trip-the-fallback.dot"`, `index = 0`: exercises blake2b fallback.

The expected hex values are computed once by running desktop's `productAccountService.deriveProductPublicKey` against the same inputs, then frozen in the test file. If desktop's algorithm changes, these tests fail in product-sdk before any consumer drifts.

**Layer B: desktop parity script.** `product-sdk/packages/keys/scripts/regenerate-fixtures.ts`: a maintenance tool (not run in CI) that replicates desktop's algorithm against the same input table and prints the expected vectors. Run manually if desktop's implementation is ever updated. Makes the "match desktop" contract auditable.

**Layer C: integration test in playground-cli.** Lightweight: one vitest case that calls `deriveProductAccountPublicKey(parentPubKey, "playground.dot", 0)` against a fixed input and asserts the SS58-encoded result. Validates the import wiring and the `@parity/product-sdk-address::ss58Encode` integration; the algorithm itself is already covered by Layer A.

**Layer D: playground-app console log.** Separate PR on `playground-app` repo. After `getProductAccount("playground.dot")` returns in `src/utils/contracts.ts:98`, add `console.info("product account:", account.address, account.h160Address)` (exact format TBD with playground-app maintainers, structured-log preferred). Gives the user an in-DevTools cross-check against the `dot init` display.

### Section 4: `dot init` identity display

**Where.** The success branch of `src/commands/init/InitScreen.tsx`. Two new lines after the existing "you're signed in" confirmation:

```
Logged in.
  Username:        alice.dot
  Product account: 5GrwvaEF…rXKDi (0x1a2b…ef34)
```

**Address line.** Computed from `ss58Encode(deriveProductAccountPublicKey(session.rootAccountId, PLAYGROUND_PRODUCT_ID, 0))` (SS58) and `deriveH160(...)` (H160). Both formats shown: SS58 is substrate-native; H160 is what the registry's owner index uses (so users can match it against `playground-app`'s "My apps" filter which keys off `account.h160Address`).

**Username line.** Queried from the on-chain identity registry (People parachain, RFC-0014 DotNS). Investigation step during implementation: confirm `@novasamatech/host-papp`'s `IdentityAdapter.readIdentities` is a chain query (not an IPC wrapper). If chain-query: import + use it directly. If IPC-wrapped: drop a layer and query People parachain via PAPI using the existing `peopleEndpoints` from `src/config.ts`.

**Privacy.** DotNS identities are public on-chain registry entries. We are only displaying the user's own username back to them, sourced from public data. No host-api `getUserId` consent prompt is needed (and would not be available from a CLI anyway). The username is not stored locally; it is re-queried each `dot init` run.

**Failure modes.**

- People endpoint unreachable: `Username: (lookup failed)`.
- Account has no on-chain identity: `Username: (no username set on chain)`.
- Account has only `liteUsername` (no `fullUsername`): display `liteUsername` (per the `Identity` type from `@novasamatech/host-papp`).
- Identity lookup hangs: time-bounded (a few seconds); on timeout, show `(lookup failed)` and surface the address line regardless.

The address line never fails; it is computed from data the CLI already holds.

### Section 5: CLI-as-host roadmap note

A markdown note at `docs/superpowers/specs/2026-05-18-cli-as-host-deferred.md`, committed alongside this spec. Captures:

1. **What we found.** `host-container` is environment-agnostic; a Node/Bun CLI Provider over Worker MessagePorts, Unix sockets, stdio, or an in-memory event bus is feasible. dotli is the reference architecture (web host pairing to mobile via QR, same trust model as our CLI).
2. **What blocks it today.** ~40 handler callbacks, a Provider transport, file-backed storage, and Ink consent prompts (~2-3 weeks) with no product to host. The CLI is currently the product side; becoming a host without an in-process product is speculative scaffolding.
3. **What triggers revisiting.** Any of: a `dot run <product>` command running products inside the CLI; a second tool wanting `SignerManager`/`HostProvider` abstractions in the CLI; product-sdk publishing a Node-runnable `HostProvider` impl we can plug into.
4. **References.** File:line pointers to `host-container/src/createContainer.ts`, `dotli/packages/ui/src/container.ts`, `dotli/packages/auth/src/auth.ts`.
5. **Non-goals.** Generating a CLI-only root mnemonic; networked host-api; refactoring `sessionSigner.ts` to use `SignerManager` without a host.

### Section 6: rename blake2b util in product-sdk

**Target.** `product-sdk/packages/sdk/src/identity/product-account.ts:34-63`, `deriveProductAccount(parentAddress, productName, ss58Prefix)`. Algorithm: `blake2b-256(parentPublicKey || productName_bytes)`. This is **not** the canonical product-account derivation; it is a context-bound alias derivation whose name misleads.

**Approach.** Hard rename, no deprecation alias, consistent across the product-sdk repo.

**Investigation step (during implementation).** Sweep callsites:

```bash
grep -rn "deriveProductAccount\b" product-sdk/
grep -rn "@parity/product-sdk/identity" product-sdk/ playground-cli/ playground-app/ dotli/ polkadot-desktop/ polkadot-app-android-v2/
```

Use the discovered callsites to pick a name that matches the function's actual usage. Best guesses pending investigation: `deriveContextAlias`, `deriveDomainSeparatedAccount`, `deriveContextAccount`, `deriveBoundedAlias`. Final choice deferred to the implementation plan.

**Changes.**

- Rename the function in `product-sdk/packages/sdk/src/identity/product-account.ts`.
- Update every callsite within `product-sdk/` (the consistency requirement).
- Update the index re-export (`@parity/product-sdk/identity`) to the new name only. Old name is removed in the same PR.
- Type renames (`ProductAccountInfo` to the corresponding new name, if appropriate).
- Changeset entry flagging the breaking change.

**External consumers.** Any external repo importing the old name will get a build error after upgrading. This is the explicit choice; we are not maintaining a deprecation alias. The changeset note plus a release notes line make the migration discoverable.

## Implementation order

Three repos, four PRs in approximately this sequence:

1. **product-sdk PR (Section 1 + Section 3 Layer A + Layer B):** add `deriveProductAccountPublicKey` and `createChainCode` to `@parity/product-sdk-keys`. Add the frozen vector test file. Add the desktop parity script. Publish a new minor version.
2. **product-sdk PR (Section 6):** rename `deriveProductAccount` (blake2b util) consistently across the repo. Publish.
3. **playground-cli PR (Sections 2, 3 Layer C, 4, 5):** bump SDK deps, swap imports, delete `productAccountDerivation.ts`. Add the integration vitest case. Add the `dot init` username + product account display lines. Commit the CLI-as-host roadmap note. Verify per CLAUDE.md.
4. **playground-app PR (Section 3 Layer D):** add the `console.info` line after `getProductAccount`. Trivial.

PR 1 and 2 can land in either order in product-sdk; PR 3 depends on PR 1. PR 4 is independent and can land anytime.

## Verification

The success criteria for this work:

- `pnpm test` in product-sdk passes the four-vector fixture for `deriveProductAccountPublicKey`.
- `pnpm test && pnpm build && pnpm format:check && pnpm lint:license` in playground-cli pass.
- `grep -rn "deriveProductAccountPublicKey" playground-cli/src/` shows imports only from `@parity/product-sdk-keys`, no local file.
- A `dot init` run shows the username and product account address lines (with appropriate fallback strings when applicable).
- The same user, logging into `playground-app`, sees the same SS58 and H160 in the browser console (Layer D log).
- `grep -rn "deriveProductAccount\b" product-sdk/ playground-cli/` shows the old blake2b util name nowhere; only the renamed version is referenced.

## Open questions deferred to implementation

- Final name of the renamed blake2b util (Section 6): picked after callsite investigation.
- Whether `IdentityAdapter.readIdentities` (Section 4) is on-chain or IPC-wrapped: decides whether we import host-papp's adapter or query People parachain directly.
- Exact UX phrasing for the two `dot init` lines: refined during implementation against the existing Ink screen styling.
- Mobile (Android) cross-verification of the derivation algorithm: currently relies on code-reading; an optional Kotlin-side fixture is out of scope here.
