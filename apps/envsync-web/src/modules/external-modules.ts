import type { WebModule } from "./types";

/**
 * Reserved FOSS extension seam (empty in public monorepo).
 *
 * Enterprise modules are **not** loaded here — they come from the Vite alias
 * `@enterprise-modules` → `envsync-enterprise-web` (enterprise) or
 * `enterprise-modules.stub.ts` (OSS). One injection mechanism only (Phase 5b).
 */
export const externalWebModules: WebModule[] = [];
