import { useNavigate, useParams, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  Plus,
  RefreshCw,
  Upload,
  Download,
  Settings,
  ChevronDown,
  Shield,
  MoreVertical,
  History,
  LockKeyhole,
  DatabaseBackup,
  PlugZap,
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { appAccessPath, appDetailPath, appIntegrationsPath, appPointInTimePath, appSecretsPath } from "@/lib/app-routes";
import { isEnterpriseDashboard } from "@/utils/runtime-config";
import { EnvironmentType } from "@/constants";

interface ProjectHeaderProps {
  projectName: string;
  environmentTypes: EnvironmentType[];
  selectedEnvironment: string;
  onEnvironmentChange: (envId: string) => void;
  totalVariables: number;
  totalSecrets: number;
  canEdit: boolean;
  isRefetching: boolean;
  enableSecrets?: boolean;
  onRefresh: () => void;
  onAddVariable: () => void;
  onBulkImport: () => void;
  onExport: () => void;
  onManageEnvironments: () => void;
}

export const ProjectHeader = ({
  projectName,
  environmentTypes,
  selectedEnvironment,
  onEnvironmentChange,
  totalVariables,
  totalSecrets,
  canEdit,
  isRefetching,
  enableSecrets,
  onRefresh,
  onAddVariable,
  onBulkImport,
  onExport,
  onManageEnvironments,
}: ProjectHeaderProps) => {
  const navigate = useNavigate();
  const { appId } = useParams();
  const location = useLocation();

  const isSecretsPage = location.pathname.includes("/secrets");
  const isManageEnvironmentPage = location.pathname.includes("/manage-environments");
  const isAccessPage = location.pathname.includes("/access");
  const isPointInTimePage = location.pathname.includes("/pit/");
  const isIntegrationsPage = location.pathname.includes("/integrations");

  const currentEnv = environmentTypes.find((e) => e.id === selectedEnvironment);

  const handleSectionChange = (
    section: "variables" | "secrets" | "environments" | "access" | "pit" | "integrations"
  ) => {
    if (!appId) return;

    let targetPath = appDetailPath(appId);
    if (section === "secrets") targetPath = appSecretsPath(appId);
    if (section === "environments") targetPath = `${appDetailPath(appId)}/manage-environments`;
    if (section === "access") targetPath = appAccessPath(appId);
    if (section === "integrations") targetPath = appIntegrationsPath(appId);
    if (section === "pit") {
      targetPath = appPointInTimePath(appId);
      const envParam = currentEnv?.name?.toLowerCase() || selectedEnvironment;
      targetPath += `?env=${encodeURIComponent(envParam)}`;
    }
    navigate(targetPath);
  };

  const onRollback = () => {
    if (!appId) return;
    let targetUrl = appPointInTimePath(appId);
    if (isSecretsPage) targetUrl += "/secrets";
    const envParam = currentEnv?.name?.toLowerCase() || selectedEnvironment;
    targetUrl += `?env=${encodeURIComponent(envParam)}`;
    navigate(targetUrl);
  };

  const tabs = [
    {
      key: "variables",
      label: "Variables",
      hidden: false,
      active: !isSecretsPage && !isManageEnvironmentPage && !isAccessPage && !isPointInTimePage && !isIntegrationsPage,
    },
    {
      key: "secrets",
      label: "Secrets",
      hidden: !enableSecrets,
      active: isSecretsPage,
    },
    {
      key: "environments",
      label: "Environments",
      hidden: false,
      active: isManageEnvironmentPage,
    },
    {
      key: "access",
      label: "Access",
      hidden: false,
      active: isAccessPage,
    },
    {
      key: "integrations",
      label: "Integrations",
      hidden: !isEnterpriseDashboard,
      active: isIntegrationsPage,
    },
    {
      key: "pit",
      label: "Recovery",
      hidden: false,
      active: isPointInTimePage,
    },
  ].filter((item) => !item.hidden);

  return (
    <div className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="mx-auto max-w-[1600px] px-5 md:px-6">
        {/* Top row: actions */}
        <div className="flex items-center justify-between gap-4 py-3">
          <div className="flex items-center gap-2 min-w-0">
          </div>

          <div className="flex items-center gap-2">
            {/* Environment switcher */}
            <Select value={selectedEnvironment} onValueChange={onEnvironmentChange}>
              <SelectTrigger className="w-[180px] h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {environmentTypes.map((envType) => (
                  <SelectItem key={envType.id} value={envType.id}>
                    <div className="flex items-center gap-2">
                      <div
                        className="w-2 h-2 rounded-full"
                        style={{ backgroundColor: envType.color }}
                      />
                      <span>{envType.name}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Actions */}
            {canEdit && (
              <>
                <Button
                  onClick={onAddVariable}
                  size="sm"
                  className="h-8"
                  data-testid={isSecretsPage ? "project-secrets-primary-action" : "project-variables-primary-action"}
                >
                  <Plus className="size-3.5 mr-1.5" />
                  {isSecretsPage ? "Add Secret" : "Add Variable"}
                </Button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm" className="h-8 w-8 p-0" aria-label="More actions">
                      <MoreVertical className="size-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={onBulkImport}>
                      <Upload className="size-4 mr-2" />
                      Bulk Import
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={onExport}>
                      <Download className="size-4 mr-2" />
                      Export
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={onRefresh} disabled={isRefetching}>
                      <RefreshCw className={cn("size-4 mr-2", isRefetching && "animate-spin")} />
                      Refresh
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={onRollback}>
                      <History className="size-4 mr-2" />
                      Recovery
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={onManageEnvironments}>
                      <Settings className="size-4 mr-2" />
                      Manage Environments
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </>
            )}
          </div>
        </div>

        {/* Tab navigation */}
        <div className="flex gap-1 -mb-px overflow-x-auto">
          {tabs.map((tab) => (
            <Button
              key={tab.key}
              variant="ghost"
              size="sm"
              onClick={() => handleSectionChange(tab.key as "variables" | "secrets" | "environments" | "access" | "pit" | "integrations")}
              className={cn(
                "rounded-none border-b-2 px-4 py-2.5 text-sm font-medium transition-colors",
                tab.active
                  ? "border-primary text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground hover:border-muted-foreground/50"
              )}
            >
              {tab.label}
            </Button>
          ))}
        </div>
      </div>
    </div>
  );
};
