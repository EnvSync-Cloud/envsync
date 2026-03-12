import { Building2 } from "lucide-react";

interface OrgSettingsHeaderProps {
  orgName?: string;
}

export const OrgSettingsHeader = ({ orgName }: OrgSettingsHeaderProps) => {
  return (
    <div className="flex items-center space-x-3">
      <div className="p-2 bg-violet-500/10 rounded-lg ring-1 ring-violet-500/20">
        <Building2 className="size-5 text-violet-400" />
      </div>
      <div>
        <h1 className="text-xl font-semibold text-gray-100 tracking-tight">Organization Settings</h1>
        <p className="text-sm text-gray-400 mt-0.5">
          Manage your organization configuration and preferences
          {orgName && (
            <span className="ml-2 text-violet-400">• {orgName}</span>
          )}
        </p>
      </div>
    </div>
  );
};
