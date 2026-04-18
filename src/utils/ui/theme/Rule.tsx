import { Box, Text, useStdout } from "ink";
import { GLYPH, LAYOUT } from "./tokens.js";

/** Horizontal hairline, dim. Caps at LAYOUT.ruleWidthMax so wide terminals don't stretch forever. */
export function Rule() {
    const { stdout } = useStdout();
    const cols = stdout?.columns ?? 80;
    const width = Math.max(10, Math.min(cols - LAYOUT.leftMargin * 2, LAYOUT.ruleWidthMax));
    return (
        <Box paddingLeft={LAYOUT.leftMargin}>
            <Text dimColor>{GLYPH.rule.repeat(width)}</Text>
        </Box>
    );
}
