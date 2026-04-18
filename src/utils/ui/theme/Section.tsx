import { Box, Text } from "ink";
import { LAYOUT } from "./tokens.js";

export function Section({
    title,
    children,
    gapBelow = true,
}: {
    title?: string;
    children: React.ReactNode;
    gapBelow?: boolean;
}) {
    return (
        <Box flexDirection="column" marginBottom={gapBelow ? 1 : 0}>
            {title && (
                <Box paddingLeft={LAYOUT.leftMargin} marginBottom={1}>
                    <Text bold>{title}</Text>
                </Box>
            )}
            {children}
        </Box>
    );
}
