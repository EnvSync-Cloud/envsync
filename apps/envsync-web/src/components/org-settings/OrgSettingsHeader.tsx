import { Building2 } from "lucide-react";

interface OrgSettingsHeaderProps {
  orgName?: string;
}

export const OrgSettingsHeader = ({ orgName }: OrgSettingsHeaderProps) => {
  return (
    <div className="flex items-center space-x-3">
      <div className="p-2 rounded-lg bg-muted text-muted-foreground">
        <Building2 className="size-5 text-muted-foreground" />
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
