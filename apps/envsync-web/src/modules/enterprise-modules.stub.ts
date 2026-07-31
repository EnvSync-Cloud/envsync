import type { WebModule } from "./types";

/**
 * OSS / FOSS dashboard build: no enterprise modules (Phase 5b).
 * Enterprise builds resolve `envsync-enterprise-web` via Vite `@enterprise-modules`.
 */
export const enterpriseWebModules: WebModule[] = [];
