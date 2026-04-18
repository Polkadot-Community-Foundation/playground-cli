import { Box, Text } from "ink";
import { LAYOUT } from "./tokens.js";

export interface LogTailProps {
    /** Most-recent-last log lines; undersized arrays are padded with blanks. */
    lines: string[];
    height: number;
}

/**
 * Fixed-height viewport of dim log lines. Used by step runners so a noisy
 * install stream doesn't push the rest of the screen around.
 *
 * This is a pure renderer — coalescing / throttling is the caller's job
 * (see RunningStage.queueInfo for the 10 Hz pattern we rely on to keep
 * setState pressure bounded on high-rate streams).
 */
export function LogTail({ lines, height }: LogTailProps) {
    return (
        <Box flexDirection="column" paddingLeft={LAYOUT.leftMargin + 2} height={height}>
            {Array.from({ length: height }, (_, i) => (
                <Text key={i} dimColor>
                    {lines[i] ?? " "}
                </Text>
            ))}
        </Box>
    );
}
