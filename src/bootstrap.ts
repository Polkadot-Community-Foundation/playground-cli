// Env-var opt-outs that MUST be applied before any `bulletin-deploy` module
// evaluates. ES-module top-level evaluation is dependency-first + ordered
// across siblings of the same parent, so importing this module as the very
// first statement in `src/index.ts` guarantees its side effects run before
// the `bulletin-deploy` import chain initialises its Sentry / memory-report
// gates. Plain `process.env.X = "0"` later in `index.ts` is too late —
// import hoisting would have already loaded Sentry and wired up the
// threshold-triggered memory report.
//
// Why we opt out by default:
//   1. Sentry buffers breadcrumbs + spans in-memory while it tries to reach
//      its endpoint; on a flaky or long-running deploy this has been seen to
//      balloon `dot`'s RSS.
//   2. bulletin-deploy's memory-report path calls `v8.getHeapSpaceStatistics()`,
//      which Bun has not implemented. Our CLI ships as a Bun-compiled binary,
//      so reaching that code path kills the deploy with
//      "node:v8 getHeapSpaceStatistics is not yet implemented in Bun."
//
// Both gates honour an explicit user override: if the caller sets either
// env var before invoking `dot`, we leave their choice alone. That lets
// Parity folks opt back in with `BULLETIN_DEPLOY_TELEMETRY=1 dot deploy`
// when they want to help debug a deploy.

// Forces ESM module semantics on this otherwise-import-free file. Without it,
// TS classifies the file as a script and `await import("./bootstrap.js")`
// resolves to `{ default: undefined }` with no export binding — TS2306 at
// every callsite in `bootstrap.test.ts`. Keep.
export {};

if (process.env.BULLETIN_DEPLOY_TELEMETRY === undefined) {
    process.env.BULLETIN_DEPLOY_TELEMETRY = "0";
}

// Defence-in-depth: the memory-report env gate lives inside
// `maybeWriteMemoryReport`, checked at call time rather than module load.
// Even if a user explicitly opts telemetry back in, this stops the
// Bun-incompatible `v8.getHeapSpaceStatistics` call from firing in our
// Bun-compiled binary.
if (process.env.BULLETIN_DEPLOY_MEM_REPORT === undefined) {
    process.env.BULLETIN_DEPLOY_MEM_REPORT = "0";
}
