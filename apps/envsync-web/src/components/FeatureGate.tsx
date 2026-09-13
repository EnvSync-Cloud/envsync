import type { ReactNode } from "react";

import { useAuthContext } from "@/contexts/auth";
import { hasEntitledFeature } from "@/lib/entitlements";

import { UpgradeEmptyState } from "./UpgradeEmptyState";

export function FeatureGate({
  feature,
  children,
}: {
  feature?: string;
  children: ReactNode;
}) {
  const { user } = useAuthContext();
  if (hasEntitledFeature(user, feature)) {
    return children;
  }
  return <UpgradeEmptyState feature={feature!} />;
}
