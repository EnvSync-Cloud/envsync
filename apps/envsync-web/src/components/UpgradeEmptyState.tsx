import { Sparkles } from "lucide-react";

const FEATURE_LABELS: Record<string, string> = {
  integrations: "Integrations",
  saml: "SSO",
  kms: "Key management",
  oidc: "Workload identity",
  rotation: "Rotation",
  dynamic_secrets: "Dynamic secrets",
  log_forwarding: "Log forwarding",
  management: "Enterprise management",
  multi_org: "Multiple organizations",
};

function featureLabel(feature: string) {
  return FEATURE_LABELS[feature] ?? feature.replaceAll("_", " ");
}

export function UpgradeEmptyState({ feature }: { feature: string }) {
  const label = featureLabel(feature);

  return (
    <div className="flex min-h-[50vh] items-center justify-center">
      <div className="mx-auto max-w-lg rounded-2xl border border-border bg-card/50 px-8 py-10 text-center">
        <div className="mx-auto mb-6 flex size-12 items-center justify-center rounded-2xl border border-emerald-500/20 bg-emerald-500/10">
          <Sparkles className="size-5 text-emerald-500" />
        </div>
        <p className="text-xs uppercase tracking-[0.22em] text-emerald-600 dark:text-emerald-300/80">
          Upgrade
        </p>
        <h1 className="mt-3 text-2xl font-semibold text-foreground">{label} is not on this plan</h1>
        <p className="mt-3 text-sm text-muted-foreground">
          {feature === "kms"
            ? "Key management is not on this plan. Existing encryption continues. Contact support to detach to managed."
            : `This organization is not entitled to ${label}. Contact your administrator to upgrade.`}
        </p>
      </div>
    </div>
  );
}
