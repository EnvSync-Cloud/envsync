/**
 * EnvSync OSS self-host deploy CLI.
 *
 * Bundles the full lifecycle engine with ENVSYNC_DEPLOY_FORCE_EDITION=oss so the
 * published npm package is self-contained (no monorepo spawn into deploy-cli).
 *
 * @see docs/plans/2026-08-no-piggyback-program.md Phase 3
 */
process.env.ENVSYNC_DEPLOY_FORCE_EDITION = "oss";

// Side-effect: runs the shared deploy CLI main with OSS edition forced.
// tsup bundles this import into dist/ so the published artifact has no monorepo path dependency.
await import("../../deploy-cli/src/index.ts");
