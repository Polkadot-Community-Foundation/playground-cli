// Copyright (C) Parity Technologies (UK) Ltd.
// SPDX-License-Identifier: Apache-2.0

// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

/**
 * A short-lived Bulletin client for the storage-signer authorization check.
 *
 * Phone-mode deploys verify the BulletInAllowance slot's on-chain
 * authorization BEFORE handing chunk uploads to polkadot-app-deploy, so a
 * missing/expired authorization fails fast with a "re-run login" message
 * instead of dying mid-upload. The check is existence + non-expiry only — the
 * Bulletin `store` extrinsic treats the tx/byte allowance counters as soft
 * limits, so there is no quota to estimate or gate on (see
 * `allowances/bulletin.ts::isAuthorizationActive`).
 *
 * Everything here is best-effort: client construction failures yield `null`,
 * which downgrades the deploy to skipping the up-front check (the slot signer
 * is still used and polkadot-app-deploy reports per-chunk truth).
 */

import { createClient } from "polkadot-api";
import { getWsProvider } from "polkadot-api/ws";
import type { CloudStorageApi } from "@parity/product-sdk-cloud-storage";
import { asCloudStorageApi } from "../allowances/bulletin.js";
import { getChainConfig, type Env } from "../../config.js";
import { BULLETIN_WS_HEARTBEAT_MS } from "../bulletinWs.js";
import { getBulletinDescriptor } from "../descriptors.js";

export interface BulletinAuthContext {
    bulletinApi: CloudStorageApi;
    /** Tears down the dedicated WS client. Always call from `finally`. */
    destroy(): void;
}

/**
 * Build a DEDICATED short-lived Bulletin client for a phone-mode deploy's
 * authorization check (same long-heartbeat rationale as the metadata upload
 * in `playground.ts` — the shared `getConnection()` client's 40 s default is
 * too tight for Bulletin round-trips). Returns null when client construction
 * fails; the caller then proceeds without the up-front check.
 */
export function createBulletinAuthContext(env: Env | undefined): BulletinAuthContext | null {
    try {
        const cfg = getChainConfig(env);
        const client = createClient(
            getWsProvider([cfg.bulletinRpc, ...cfg.bulletinRpcFallbacks], {
                heartbeatTimeout: BULLETIN_WS_HEARTBEAT_MS,
            }),
        );
        return {
            bulletinApi: asCloudStorageApi(client.getTypedApi(getBulletinDescriptor(cfg.env))),
            destroy: () => client.destroy(),
        };
    } catch {
        return null;
    }
}
