/**
 * Vault mock stub — kept as no-ops so existing test imports don't break.
 * Vault was removed in the STDB consolidation; encryption is now handled
 * by SpacetimeDB reducers.
 */

/** No-op — vault storage no longer exists */
export function resetVault(): void {}
