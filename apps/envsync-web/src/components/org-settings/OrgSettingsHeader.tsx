import { Building2 } from "lucide-react";

interface OrgSettingsHeaderProps {
  orgName?: string;
}

export const OrgSettingsHeader = ({ orgName }: OrgSettingsHeaderProps) => {
  return (
    <div className="flex items-center space-x-3">
      <div className="p-2 bg-emerald-500/10 rounded-lg ring-1 ring-emerald-500/20">
        <Building2 className="size-5 text-emerald-400" />
      </div>
      <div>
        <h1 data-testid="org-settings-heading" className="text-xl font-semibold tracking-tight text-foreground">
          Organization
        </h1>
        {orgName ? <p className="text-sm text-muted-foreground">{orgName}</p> : null}
      </div>
    </div>
  );
};
