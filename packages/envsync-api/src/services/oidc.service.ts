/**
 * H7/H3: implementation lives in proprietary package `envsync-enterprise`.
 * Re-export keeps existing `@/services/...` imports working without a production
 * package.json dependency on envsync-enterprise (monorepo path only).
 */
export * from "../../../envsync-enterprise/src/services/oidc.service.ts";
