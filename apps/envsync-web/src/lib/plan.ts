export function planFlagEnabled(
  user: { plan_limits?: Record<string, unknown> } | null | undefined,
  flag: string,
): boolean {
  const value = user?.plan_limits?.[flag];
  if (value === undefined) return true;
  return value !== false;
}

export function isPlanFeatureRequired(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const record = error as { code?: unknown; body?: { code?: unknown } };
  return record.code === "PLAN_FEATURE_REQUIRED" || record.body?.code === "PLAN_FEATURE_REQUIRED";
}
