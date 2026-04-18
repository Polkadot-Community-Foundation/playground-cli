import { Box, Text } from "ink";
import { COLOR, LAYOUT } from "./tokens.js";
import { Mark, type MarkKind } from "./Mark.js";

type ValueTone = "default" | "danger" | "warning" | "muted" | "accent";

export interface RowProps {
    mark?: MarkKind;
    label: string;
    value?: string;
    hint?: string;
    /** Controls vertical alignment of `value` across sibling Rows. */
    labelWidth?: number;
    /** Semantic color for the value — e.g. danger for "expired". */
    tone?: ValueTone;
}

/** A labeled status line: [mark] label (padded) value  — optional dim hint below. */
export function Row({
    mark,
    label,
    value,
    hint,
    labelWidth = LAYOUT.defaultLabelWidth,
    tone = "default",
}: RowProps) {
    const paddedLabel = label.length >= labelWidth ? label + " " : label.padEnd(labelWidth);
    return (
        <Box flexDirection="column" paddingLeft={LAYOUT.leftMargin}>
            <Box flexDirection="row">
                {mark && (
                    <Box marginRight={1}>
                        <Mark kind={mark} />
                    </Box>
                )}
                <Text>{paddedLabel}</Text>
                {value !== undefined && <ValueText tone={tone}>{value}</ValueText>}
            </Box>
            {hint && (
                <Box paddingLeft={mark ? 4 : 2}>
                    <Text dimColor>{hint}</Text>
                </Box>
            )}
        </Box>
    );
}

function ValueText({ tone, children }: { tone: ValueTone; children: string }) {
    switch (tone) {
        case "danger":
            return <Text color={COLOR.danger}>{children}</Text>;
        case "warning":
            return <Text color={COLOR.warning}>{children}</Text>;
        case "accent":
            return <Text color={COLOR.accent}>{children}</Text>;
        case "muted":
            return <Text dimColor>{children}</Text>;
        default:
            return <Text>{children}</Text>;
    }
}
