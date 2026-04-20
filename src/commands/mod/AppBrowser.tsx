import { useState, useEffect, useRef, useCallback } from "react";
import { Box, Text, useInput, useStdout } from "ink";
import { getGateway, fetchJson } from "@polkadot-apps/bulletin";
import { Mark, Hint, COLOR } from "../../utils/ui/theme/index.js";

export interface AppEntry {
    domain: string;
    name: string | null;
    description: string | null;
    repository: string | null;
}

interface Props {
    registry: any;
    onSelect: (app: AppEntry) => void;
}

const BATCH = 10;
const COL = { num: 5, domain: 33, name: 37 };

function pad(s: string, w: number): string {
    return s.length > w ? s.slice(0, w - 1) + "…" : s.padEnd(w);
}

export function AppBrowser({ registry, onSelect }: Props) {
    const { stdout } = useStdout();
    const viewH = Math.max((stdout?.rows ?? 24) - 6, 5);

    const [apps, setApps] = useState<AppEntry[]>([]);
    const [total, setTotal] = useState(0);
    const [cursor, setCursor] = useState(0);
    const [scroll, setScroll] = useState(0);
    const [fetching, setFetching] = useState(true);
    // Next ascending-index window to request from `getApps(start, count)`. We
    // page high → low (newest-first), so this walks downward: the next call's
    // `start` is `prevStart - BATCH` (clamped to 0). `null` means no more.
    const nextStart = useRef<number | null>(null);

    const gateway = getGateway("paseo");

    const loadBatch = useCallback(
        async (start: number) => {
            setFetching(true);

            // Contract returns entries ascending from `start`. We want
            // newest-first in the list, so reverse after. `count` may be
            // capped short if `start + count > total` — no harm, the
            // contract simply returns fewer entries.
            const res = await registry.getApps.query(start, BATCH);
            const rawEntries = res.value.entries as Array<{
                index: number;
                domain: string;
                metadata_uri: string;
                owner: string;
            }>;
            // Keep our `total` in sync with the contract's reported value.
            // Always calling setTotal is fine — React bails out on same-value
            // updates, so this doesn't cause extra renders.
            setTotal(res.value.total as number);

            // Sort defensively — we can't rely on the contract's ordering
            // guarantees, and every entry carries its own `index`.
            const sorted = [...rawEntries].sort((a, b) => b.index - a.index);

            nextStart.current = start > 0 ? Math.max(0, start - BATCH) : null;

            const entries: AppEntry[] = sorted.map((e) => ({
                domain: e.domain,
                name: null,
                description: null,
                repository: null,
            }));

            setApps((prev) => [...prev, ...entries]);
            setFetching(false);

            // Metadata JSONs still have to be fetched one-at-a-time from
            // the gateway — that's IPFS HTTP, not a chain query. Kick them
            // off in parallel and update each row as it lands.
            await Promise.allSettled(
                sorted.map(async (raw, i) => {
                    const entry = entries[i];
                    const cid = raw.metadata_uri;
                    if (!cid) return;
                    const meta = await fetchJson<Record<string, string>>(cid, gateway);
                    setApps((prev) =>
                        prev.map((a) =>
                            a === entry
                                ? {
                                      ...a,
                                      name: meta.name ?? null,
                                      description: meta.description ?? null,
                                      repository: meta.repository ?? null,
                                  }
                                : a,
                        ),
                    );
                }),
            );
        },
        [registry, gateway],
    );

    useEffect(() => {
        (async () => {
            const res = await registry.getAppCount.query();
            const count = res.value as number;
            setTotal(count);
            if (count > 0) await loadBatch(Math.max(0, count - BATCH));
            else setFetching(false);
        })();
    }, [registry, loadBatch]);

    useEffect(() => {
        if (cursor >= apps.length - 3 && nextStart.current !== null && !fetching) {
            loadBatch(nextStart.current);
        }
    }, [cursor, apps.length, fetching, loadBatch]);

    useInput((input, key) => {
        if (key.upArrow && cursor > 0) {
            const next = cursor - 1;
            setCursor(next);
            if (next < scroll) setScroll(next);
        }
        if (key.downArrow && cursor < apps.length - 1) {
            const next = cursor + 1;
            setCursor(next);
            if (next >= scroll + viewH) setScroll(next - viewH + 1);
        }
        if (key.return && apps.length > 0) onSelect(apps[cursor]);
        if (input === "q") process.exit(0);
    });

    const visible = apps.slice(scroll, scroll + viewH);
    const descW = Math.max((stdout?.columns ?? 80) - COL.num - COL.domain - COL.name - 10, 10);

    return (
        <Box flexDirection="column" paddingLeft={2}>
            <Box>
                <Text dimColor>
                    {`${pad(" #", COL.num)}  ${pad("domain", COL.domain)}  ${pad(
                        "name",
                        COL.name,
                    )}  description`}
                </Text>
            </Box>
            <Box>
                <Text dimColor>{"─".repeat(COL.num + COL.domain + COL.name + descW + 6)}</Text>
            </Box>

            {visible.map((app, i) => {
                const idx = scroll + i;
                const sel = idx === cursor;
                const num = sel
                    ? `›${String(idx + 1).padStart(COL.num - 1)}`
                    : ` ${String(idx + 1).padStart(COL.num - 1)}`;
                return (
                    <Box key={idx}>
                        <Text bold={sel} color={sel ? COLOR.accent : undefined}>
                            {`${num}  ${pad(app.domain, COL.domain)}  ${pad(
                                app.name ?? (app.name === null ? "…" : "—"),
                                COL.name,
                            )}  ${pad(app.description ?? "", descW)}`}
                        </Text>
                    </Box>
                );
            })}

            {fetching && (
                <Box gap={1} marginTop={1} paddingLeft={0}>
                    <Mark kind="run" />
                    <Text dimColor>loading apps…</Text>
                </Box>
            )}
            <Box marginTop={fetching ? 0 : 1}>
                <Hint>{`↑↓ navigate  ·  ⏎ select  ·  q quit  ·  (${apps.length}/${total})`}</Hint>
            </Box>
        </Box>
    );
}
