/**
 * Enterprise deploy CLI entry (private package).
 *
 * Does **not** own the deploy engine. Forces enterprise edition and runs the
 * MIT engine published from `@envsync-cloud/deploy` (source under packages/deploy).
 *
 * Open-core direction: EE depends on OSS, never the reverse.
 */
process.env.ENVSYNC_DEPLOY_FORCE_EDITION = "enterprise";

// Workspace/public subpath: engine owned by OSS package (see packages/deploy/src/cli.ts).
await import("@envsync-cloud/deploy/cli");
