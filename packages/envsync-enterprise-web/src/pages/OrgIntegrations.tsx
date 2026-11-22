import { EnterpriseOrgAssetsPanel } from "../components/EnterpriseOrgAssetsPanel";

export default function OrgIntegrations() {
  return (
    <div className="mx-auto max-w-7xl space-y-8 px-6 py-8">
      <div className="space-y-1">
        <h1 className="text-xl font-semibold text-foreground">Shared provider connections and org secrets</h1>
        <p className="max-w-4xl text-sm text-muted-foreground">
          Manage the organization-level credentials and secret references that power enterprise sync flows across projects.
        </p>
      </div>

      <EnterpriseOrgAssetsPanel showUsage />
    </div>
  );
}
