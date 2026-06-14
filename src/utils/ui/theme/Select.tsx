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

import { useEffect, useState } from "react";
import { Box, Text, useInput } from "ink";
import { COLOR, GLYPH, LAYOUT } from "./tokens.js";
import { firstEnabledIndex, nextEnabledIndex } from "./selectNav.js";

export interface SelectOption<T> {
    value: T;
    label: string;
    hint?: string;
    /** Greyed out and unselectable; the cursor skips over it. */
    disabled?: boolean;
}

export interface SelectProps<T> {
    label: string;
    options: SelectOption<T>[];
    initialIndex?: number;
    onSelect: (value: T) => void;
    /** Fires with the highlighted value on mount and whenever the cursor moves
        (before Enter confirms). Lets callers reveal context for the focused option. */
    onHighlight?: (value: T) => void;
}

/** Keyboard picker: ↑/↓ move, Enter confirms. Replaces the ad-hoc SignerPrompt / YesNoPrompt shapes. */
export function Select<T>({
    label,
    options,
    initialIndex = 0,
    onSelect,
    onHighlight,
}: SelectProps<T>) {
    const [index, setIndex] = useState(() =>
        firstEnabledIndex(options, Math.min(Math.max(initialIndex, 0), options.length - 1)),
    );

    useEffect(() => {
        onHighlight?.(options[index].value);
        // Re-fire only when the highlighted index changes; options/onHighlight
        // are stable for the lifetime of a given prompt.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [index]);

    useInput((_input, key) => {
        if (key.upArrow || key.leftArrow) {
            setIndex((i) => nextEnabledIndex(options, i, -1));
        }
        if (key.downArrow || key.rightArrow) {
            setIndex((i) => nextEnabledIndex(options, i, 1));
        }
        // The cursor never rests on a disabled option, but guard anyway so a
        // confirm can't slip through if every option is disabled.
        if (key.return && !options[index].disabled) onSelect(options[index].value);
    });

    return (
        <Box flexDirection="column" paddingLeft={LAYOUT.leftMargin}>
            <Box marginBottom={1}>
                <Text bold>{label}</Text>
            </Box>
            {options.map((opt, i) => {
                const selected = i === index;
                const disabled = !!opt.disabled;
                return (
                    <Box key={i} flexDirection="row">
                        <Text color={selected ? COLOR.accent : undefined}>
                            {selected ? `${GLYPH.cursor} ` : "  "}
                        </Text>
                        <Text
                            color={selected ? COLOR.accent : undefined}
                            bold={selected}
                            dimColor={disabled}
                        >
                            {opt.label}
                        </Text>
                        {opt.hint && (
                            <>
                                <Text dimColor>{`  ${GLYPH.separator}  `}</Text>
                                <Text dimColor>{opt.hint}</Text>
                            </>
                        )}
                    </Box>
                );
            })}
        </Box>
    );
}
