import { Link } from "react-router-dom";

import { FeatureDocsLink } from "@/components/FeatureDocsLink";
import { useAuthContext } from "@/contexts/auth";
import { appServiceTokensPath } from "@/lib/app-routes";
import { docsUrlForSettingsTab } from "@/lib/docs-links";
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
      {tabs.map((tab) => {
        const docsHref = docsUrlForSettingsTab(tab.id);
        return (
          <span key={tab.id} className="inline-flex items-center gap-1">
            <Link
              to={tab.href}
              data-testid={`project-settings-tab-${tab.id}`}
              className={
                tab.id === active
                  ? "rounded-lg border border-border bg-accent px-3 py-1.5 text-sm font-medium text-foreground"
                  : "rounded-lg border border-transparent px-3 py-1.5 text-sm text-muted-foreground hover:bg-muted"
              }
            >
              {tab.label}
            </Link>
            {docsHref && (
              <FeatureDocsLink
                href={docsHref}
                label={tab.label}
                side="bottom"
                className="size-4"
                testId={`project-settings-docs-${tab.id}`}
              />
            )}
          </span>
        );
      })}
    </nav>
  );
}
