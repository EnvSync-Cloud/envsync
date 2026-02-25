/**
 * KMS/PKI mock stub — kept as no-ops so existing test imports don't break.
 * miniKMS was removed in the STDB consolidation; encryption and PKI are now
 * handled by SpacetimeDB reducers.
 */

/** No-op — PKI state no longer exists locally */
export function resetPKI(): void {}
