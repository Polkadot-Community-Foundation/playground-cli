import { useState } from "react";
import { Box, Text, useInput } from "ink";
import { COLOR, GLYPH, LAYOUT } from "./tokens.js";

export interface SelectOption<T> {
    value: T;
    label: string;
    hint?: string;
}

export interface SelectProps<T> {
    label: string;
    options: SelectOption<T>[];
    initialIndex?: number;
    onSelect: (value: T) => void;
}

/** Keyboard picker: ↑/↓ move, Enter confirms. Replaces the ad-hoc SignerPrompt / YesNoPrompt shapes. */
export function Select<T>({ label, options, initialIndex = 0, onSelect }: SelectProps<T>) {
    const [index, setIndex] = useState(Math.min(Math.max(initialIndex, 0), options.length - 1));

    useInput((_input, key) => {
        if (key.upArrow || key.leftArrow) {
            setIndex((i) => (i - 1 + options.length) % options.length);
        }
        if (key.downArrow || key.rightArrow) {
            setIndex((i) => (i + 1) % options.length);
        }
        if (key.return) onSelect(options[index].value);
    });

    return (
        <Box flexDirection="column" paddingLeft={LAYOUT.leftMargin}>
            <Box marginBottom={1}>
                <Text bold>{label}</Text>
            </Box>
            {options.map((opt, i) => {
                const selected = i === index;
                return (
                    <Box key={i} flexDirection="row">
                        <Text color={selected ? COLOR.accent : undefined}>
                            {selected ? `${GLYPH.cursor} ` : "  "}
                        </Text>
                        <Text color={selected ? COLOR.accent : undefined} bold={selected}>
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
