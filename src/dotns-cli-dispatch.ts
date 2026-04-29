import { pathToFileURL } from "node:url";
// @ts-expect-error Bun's file import attribute embeds the bundled DotNS CLI file.
import dotnsCliPath from "../node_modules/@parity/dotns-cli/dist/cli.js" with { type: "file" };

export function buildDotnsCliArgv(argv: string[], scriptPath = dotnsCliPath): string[] {
    return [process.argv[0] ?? "dot", scriptPath, ...argv];
}

export async function runDotnsCliSubprocess(argv: string[]): Promise<number> {
    process.argv = buildDotnsCliArgv(argv);
    const mod = (await import(pathToFileURL(dotnsCliPath).href)) as {
        main?: (argv?: string[]) => Promise<number>;
    };
    if (typeof mod.main !== "function") {
        throw new Error("Embedded DotNS CLI did not export main()");
    }
    return await mod.main(process.argv);
}
