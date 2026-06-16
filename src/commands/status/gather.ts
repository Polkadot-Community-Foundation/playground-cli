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

import type { SessionHandle, SessionAddresses } from "../../utils/auth.js";
import type { PaseoClient } from "../../utils/connection.js";
import {
    checkAttestation,
    getBulletinBlockTimeMs,
    formatAttestation,
    type FormattedAttestation,
} from "../../utils/account/attestation.js";
import { readPgasBalance } from "../../utils/account/pgas.js";
import { getCachedBulletinSlotAddress } from "../../utils/allowances/bulletin.js";
import { readLoginStampMs } from "../../utils/loginStamp.js";

const AT_BEST = { at: "best" } as const;

/** A chain-dependent field: `ok:false` means the read failed (rendered "unavailable"). */
export type FieldResult<T> = { ok: true; value: T } | { ok: false };

/**
 * Injectable I/O seam so `buildStatusReport` is unit-testable without mocking
 * polkadot-api primitives. Production code uses `defaultReaders`.
 */
export interface StatusReaders {
    readNativeBalance(client: PaseoClient, address: string): Promise<bigint>;
    /** PGAS balance in planck (formatted at the PAS decimal scale by the screen). */
    readPgas(client: PaseoClient, address: string): Promise<bigint>;
    /** Returns null when the Bulletin allowance was never granted on this machine. */
    readBulletinAuth(
        client: PaseoClient,
        adapter: SessionHandle["adapter"],
    ): Promise<FormattedAttestation | null>;
    readLoginStampMs(): Promise<number | null>;
}

export interface StatusReport {
    addresses: SessionAddresses;
    nativeBalance: FieldResult<bigint>;
    pgas: FieldResult<bigint>;
    /** `value: null` inside an ok result = allowance not granted yet. */
    bulletin: FieldResult<FormattedAttestation | null>;
    loginStampMs: number | null;
}

async function field<T>(read: () => Promise<T>): Promise<FieldResult<T>> {
    try {
        return { ok: true, value: await read() };
    } catch {
        return { ok: false };
    }
}

export const defaultReaders: StatusReaders = {
    async readNativeBalance(client, address) {
        const account = await client.assetHub.query.System.Account.getValue(address, AT_BEST);
        return account.data.free;
    },
    readPgas: readPgasBalance,
    async readBulletinAuth(client, adapter) {
        const slotAddress = await getCachedBulletinSlotAddress(adapter);
        if (!slotAddress) return null;
        const [status, blockTimeMs] = await Promise.all([
            checkAttestation(client, slotAddress),
            getBulletinBlockTimeMs(client),
        ]);
        return formatAttestation(status, blockTimeMs);
    },
    readLoginStampMs,
};

/**
 * Assemble the status report from a resolved session handle and a (possibly
 * null) chain client. Chain reads degrade independently — a single RPC failure
 * marks only its own field unavailable. When `client` is null (connection
 * failed), every chain field is unavailable but the locally-derived addresses
 * and login stamp still render.
 */
export async function buildStatusReport(
    handle: SessionHandle,
    client: PaseoClient | null,
    readers: StatusReaders = defaultReaders,
): Promise<StatusReport> {
    const { addresses } = handle;

    const [nativeBalance, pgas, bulletin, loginStampMs] = await Promise.all([
        client
            ? field(() => readers.readNativeBalance(client, addresses.productAddress))
            : Promise.resolve<FieldResult<bigint>>({ ok: false }),
        client
            ? field(() => readers.readPgas(client, addresses.productAddress))
            : Promise.resolve<FieldResult<bigint>>({ ok: false }),
        client
            ? field(() => readers.readBulletinAuth(client, handle.adapter))
            : Promise.resolve<FieldResult<FormattedAttestation | null>>({ ok: false }),
        readers.readLoginStampMs().catch(() => null),
    ]);

    return { addresses, nativeBalance, pgas, bulletin, loginStampMs };
}
