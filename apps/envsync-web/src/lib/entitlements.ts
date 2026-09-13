export function hasEntitledFeature(
  user: { features?: readonly string[] } | null | undefined,
  feature?: string,
): boolean {
  if (!feature) return true;
  return Boolean(user?.features?.includes(feature));
}
