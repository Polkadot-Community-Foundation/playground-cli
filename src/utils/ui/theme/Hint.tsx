import { Box, Text } from "ink";
import { LAYOUT } from "./tokens.js";

/** Dim footer text — keybind rows, secondary context. */
export function Hint({ children, indent = 0 }: { children: React.ReactNode; indent?: number }) {
    return (
        <Box paddingLeft={LAYOUT.leftMargin + indent}>
            <Text dimColor>{children}</Text>
        </Box>
    );
}
