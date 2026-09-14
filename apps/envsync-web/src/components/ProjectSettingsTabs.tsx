import { Link } from "react-router-dom";

import { useAuthContext } from "@/contexts/auth";
import { appServiceTokensPath } from "@/lib/app-routes";
import { getProjectSettingsTabs } from "@/modules/load-modules";

export function ProjectSettingsTabs({
  appId,
  active,
}: {
  appId: string;
  active: string;
}) {
  const { allowedScopes } = useAuthContext();
  const tabs = [
    { id: "tokens", href: appServiceTokensPath(appId), label: "Service tokens" },
    ...getProjectSettingsTabs(appId, allowedScopes),
  ];

  if (tabs.length <= 1) return null;

  return (
    <nav className="flex flex-wrap gap-2" data-testid="project-settings-tabs">
      {tabs.map((tab) => (
        <Link
          key={tab.id}
          to={tab.href}
          data-testid={`project-settings-tab-${tab.id}`}
          className={
            tab.id === active
              ? "rounded-lg border border-emerald-400/40 bg-emerald-500/15 px-3 py-1.5 text-sm font-medium text-foreground"
              : "rounded-lg border border-border px-3 py-1.5 text-sm text-muted-foreground hover:bg-muted"
          }
        >
          {tab.label}
        </Link>
      ))}
    </nav>
  );
}
