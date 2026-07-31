import { EnterpriseOrgAssetsPanel } from "../components/EnterpriseOrgAssetsPanel";

export default function OrgIntegrations() {
  return (
    <div className="mx-auto max-w-7xl space-y-8 px-6 py-8">
      <div className="space-y-3">
        <p className="text-xs uppercase tracking-[0.24em] text-emerald-600 dark:text-emerald-300/80">Enterprise Integrations</p>
        <h1 className="text-3xl font-semibold text-foreground">Shared provider connections and org secrets</h1>
        <p className="max-w-4xl text-sm text-muted-foreground">
          Manage the organization-level credentials and secret references that power enterprise sync flows across projects.
        </p>
      </div>

      <EnterpriseOrgAssetsPanel showUsage />
    </div>
  );
}
