interface OrgSettingsHeaderProps {
  orgName?: string;
}

export const OrgSettingsHeader = ({ orgName }: OrgSettingsHeaderProps) => {
  return (
    <div>
      <h1 className="text-3xl font-bold text-white">Organization Settings</h1>
      <p className="text-gray-400 mt-2">
        Manage your organization configuration and preferences
        {orgName && (
          <span className="ml-2 text-electric_indigo-400">• {orgName}</span>
        )}
      </p>
    </div>
  );
};
