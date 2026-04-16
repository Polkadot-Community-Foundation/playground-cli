import { Text } from "ink";

const SPINNER_FRAMES = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];

export function Spinner({ tick }: { tick: number }) {
    return <Text color="yellow">{SPINNER_FRAMES[tick % SPINNER_FRAMES.length]}</Text>;
}

export function Done() {
    return <Text color="green">✔</Text>;
}

export function Failed() {
    return <Text color="red">✖</Text>;
}

export function Warning() {
    return <Text color="yellow">!</Text>;
}
