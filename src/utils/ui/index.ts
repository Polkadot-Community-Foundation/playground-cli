/**
 * Public TUI surface: re-exports the theme plug (the visual system) and
 * the shared StepRunner (the sequential-steps runner built on top of it).
 *
 * Screens import everything they need from this module. The theme itself
 * lives in `./theme/` — edit that directory to change the look.
 */

export * from "./theme/index.js";
export { StepRunner, type Step, type StepRunnerResult } from "./components/StepRunner.js";
