import { Box, Text } from "ink";
import { COLOR, LAYOUT } from "./tokens.js";

type CalloutTone = "accent" | "warning" | "danger" | "success";

/**
 * Light-touch bordered panel for moments that must interrupt scanning —
 * e.g. the "check your phone" sign-in prompt during a deploy. Use sparingly;
 * overusing this reverts the aesthetic to card-soup.
 */
export function Callout({
    tone = "accent",
    title,
    children,
}: {
    tone?: CalloutTone;
    title?: string;
    children: React.ReactNode;
}) {
    const color = toneToColor(tone);
    return (
        <Box
            marginLeft={LAYOUT.leftMargin}
            marginTop={1}
            marginBottom={1}
            borderStyle="round"
            borderColor={color}
            paddingX={1}
            flexDirection="column"
        >
            {title && (
                <Text color={color} bold>
                    {title}
                </Text>
            )}
            {children}
        </Box>
    );
}

function toneToColor(tone: CalloutTone) {
    switch (tone) {
        case "danger":
            return COLOR.danger;
        case "warning":
            return COLOR.warning;
        case "success":
            return COLOR.success;
        default:
            return COLOR.accent;
    }
}
