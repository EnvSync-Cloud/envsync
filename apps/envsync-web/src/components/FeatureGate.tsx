import { useEffect, type ReactNode } from "react";

import { useAuthContext } from "@/contexts/auth";
import { hasEntitledFeature } from "@/lib/entitlements";
import { trackAction } from "@/telemetry";

import { UpgradeEmptyState } from "./UpgradeEmptyState";

export function FeatureGate({
  feature,
  children,
}: {
  feature?: string;
  children: ReactNode;
}) {
  const { user } = useAuthContext();
  const allowed = hasEntitledFeature(user, feature);

  useEffect(() => {
    if (!feature || allowed) return;
    trackAction("upgrade_gate_viewed", { feature });
  }, [allowed, feature]);

  if (allowed) {
    return children;
  }
  return <UpgradeEmptyState feature={feature!} />;
}
