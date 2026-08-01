/**
 * EnvSync OSS self-host deploy CLI entry.
 *
 * Engine source of truth lives in this package (`./cli.ts`). Enterprise CLI is a
 * thin wrapper that forces edition=enterprise and depends on this package.
 *
 * @see docs/plans/2026-08-no-piggyback-program.md Phase 3 / no-piggyback P0
 */
process.env.ENVSYNC_DEPLOY_FORCE_EDITION = "oss";

await import("./cli.ts");
