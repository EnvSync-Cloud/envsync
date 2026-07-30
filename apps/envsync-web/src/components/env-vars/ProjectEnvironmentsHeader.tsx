import { useNavigate, useParams, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  ArrowLeft,
  Plus,
  RefreshCw,
  Upload,
  Download,
  Settings,
  Database,
  ChevronDown,
  Shield,
  MoreVertical,
  History,
  GitPullRequest,
  LockKeyhole,
  FolderKanban,
  DatabaseBackup,
  PlugZap,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { appAccessPath, appDetailPath, appIntegrationsPath, appPointInTimePath, appSecretsPath } from "@/lib/app-routes";
import { isEnterpriseDashboard } from "@/utils/runtime-config";

interface ProjectEnvironmentsHeaderProps {
  projectName: string;
  environmentId: string;
  environmentName?: string;
  totalVariables: number;
  totalSecrets: number;
  environmentTypes: number;
  canEdit: boolean;
  isRefetching: boolean;
  enableSecrets?: boolean;
  onBack: () => void;
  onRefresh: () => void;
  onAddVariable: () => void;
  onBulkImport: () => void;
  onExport: () => void;
  onManageEnvironments: () => void;
}

export const ProjectEnvironmentsHeader = ({
  projectName,
  environmentId,
  environmentName,
  totalVariables,
  totalSecrets,
  environmentTypes,
  canEdit,
  isRefetching,
  enableSecrets,
  onBack,
  onRefresh,
  onAddVariable,
  onBulkImport,
  onExport,
  onManageEnvironments,
}: ProjectEnvironmentsHeaderProps) => {
  const navigate = useNavigate();
  const { appId } = useParams();
  const location = useLocation();

  const isSecretsPage = location.pathname.includes("/secrets");
  const isManageEnvironmentPage = location.pathname.includes("/manage-environments");
  const isAccessPage = location.pathname.includes("/access");
  const isPointInTimePage = location.pathname.includes("/pit/");
  const isIntegrationsPage = location.pathname.includes("/integrations");
  const currentSection = isSecretsPage
    ? "Secrets"
    : isManageEnvironmentPage
      ? "Environments"
      : isAccessPage
        ? "Access"
        : isIntegrationsPage
          ? "Integrations"
        : isPointInTimePage
          ? "Recovery"
          : "Variables";

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
      const envParam = environmentName?.toLowerCase() || environmentId;
      targetPath += `?env=${encodeURIComponent(envParam)}`;
    }
    navigate(targetPath);
  };

  const onRollback = () => {
    if (!appId) return;
    let targetUrl = appPointInTimePath(appId);
    if (currentSection === "Secrets") targetUrl += "/secrets";
    const envParam = environmentName?.toLowerCase() || environmentId;
    targetUrl += `?env=${encodeURIComponent(envParam)}`;

    navigate(targetUrl);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <Button
          onClick={onBack}
          variant="ghost"
          size="sm"
          className="text-muted-foreground hover:text-foreground hover:bg-muted"
        >
          <ArrowLeft className="size-4 mr-1" />
          Back to Projects
        </Button>
        <span className="text-tertiary">/</span>
        <span className="text-muted-foreground">{projectName}</span>
        <span className="text-tertiary">/</span>
        <span className="flex items-center px-3 py-2 font-medium text-foreground">
          <FolderKanban className="mr-2 w-4 h-4" />
          {currentSection}
        </span>
      </div>

      <div className="overflow-hidden rounded-[28px] border border-white/10 bg-gradient-to-br from-[#10131d] via-[#0d1119] to-[#0a0f17] shadow-xl shadow-black/20">
        <div className="space-y-6 p-6">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
            <div className="space-y-4">
              <div>
                <div className="mb-3 flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-500/10 ring-1 ring-emerald-500/20">
                    {isSecretsPage ? (
                      <Shield className="w-5 h-5 text-red-300" />
                    ) : (
                      <Database className="w-5 h-5 text-emerald-300" />
                    )}
                  </div>
                  <div>
                    <h1 className="text-3xl font-medium tracking-tight text-foreground">
                      {projectName}
                    </h1>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {isSecretsPage
                        ? "Manage encrypted runtime credentials, rotate values safely, and keep secret operations visible."
                        : "Operate variables by environment, compare changes, and move faster without losing context."}
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap gap-3">
                <Badge variant="secondary" className="bg-white/[0.05] px-3 py-1.5 text-foreground">
                  {environmentName || "Environment"} selected
                </Badge>
                <Badge variant="secondary" className="bg-white/[0.05] px-3 py-1.5 text-foreground">
                  {environmentTypes} environments
                </Badge>
                <Badge
                  variant="secondary"
                  className={cn(
                    "px-3 py-1.5",
                    isSecretsPage
                      ? "bg-red-500/10 text-red-200"
                      : "bg-emerald-500/10 text-emerald-200"
                  )}
                >
                  {isSecretsPage ? `${totalSecrets} secrets` : `${totalVariables} variables`}
                </Badge>
                {enableSecrets && (
                  <Badge variant="secondary" className="bg-emerald-500/10 px-3 py-1.5 text-emerald-200">
                    Secrets enabled
                  </Badge>
                )}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <Button
                variant="outline"
                className="text-foreground border-border hover:bg-muted"
                onClick={() => navigate(appAccessPath(appId ?? ""))}
              >
                <LockKeyhole className="w-4 h-4 mr-2" />
                Access
              </Button>
              <Button
                variant="outline"
                className="text-foreground border-border hover:bg-muted"
                onClick={() => navigate("/change-requests")}
              >
                <GitPullRequest className="w-4 h-4 mr-2" />
                Change Requests
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-muted-foreground border-border hover:bg-muted"
                  >
                    <MoreVertical className="w-4 h-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  className="bg-card border-border min-w-[180px]"
                  align="end"
                >
                  <DropdownMenuItem
                    onClick={onRefresh}
                    disabled={isRefetching}
                    className="text-foreground hover:bg-muted cursor-pointer"
                  >
                    <RefreshCw
                      className={`w-4 h-4 mr-2 ${
                        isRefetching ? "animate-spin" : ""
                      }`}
                    />
                    Refresh
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={onExport}
                    className="text-foreground hover:bg-muted cursor-pointer"
                  >
                    <Download className="w-4 h-4 mr-2" />
                    Export
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={onRollback}
                    className="text-foreground hover:bg-muted cursor-pointer"
                  >
                    <History className="w-4 h-4 mr-2" />
                    Recovery
                  </DropdownMenuItem>
                  {canEdit && (
                    <DropdownMenuItem
                      onClick={onManageEnvironments}
                      className="text-foreground hover:bg-muted cursor-pointer"
                    >
                      <Settings className="w-4 h-4 mr-2" />
                      Manage environments
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

          <div className="flex flex-wrap gap-2 rounded-2xl border border-white/10 bg-muted p-2">
            {[
              {
                key: "variables",
                label: "Variables",
                icon: Settings,
                hidden: false,
                active: !isSecretsPage && !isManageEnvironmentPage && !isAccessPage && !isPointInTimePage,
              },
              {
                key: "secrets",
                label: "Secrets",
                icon: Shield,
                hidden: !enableSecrets,
                active: isSecretsPage,
              },
              {
                key: "environments",
                label: "Environments",
                icon: ChevronDown,
                hidden: false,
                active: isManageEnvironmentPage,
              },
              {
                key: "access",
                label: "Access",
                icon: LockKeyhole,
                hidden: false,
                active: isAccessPage,
              },
              {
                key: "integrations",
                label: "Integrations",
                icon: PlugZap,
                hidden: !isEnterpriseDashboard,
                active: isIntegrationsPage,
              },
              {
                key: "pit",
                label: "Recovery",
                icon: DatabaseBackup,
                hidden: false,
                active: isPointInTimePage,
              },
            ]
              .filter((item) => !item.hidden)
              .map((item) => {
                const Icon = item.icon;
                return (
                  <Button
                    key={item.key}
                    type="button"
                    variant="ghost"
                    onClick={() => handleSectionChange(item.key as "variables" | "secrets" | "environments" | "access" | "pit" | "integrations")}
                    className={cn(
                      "rounded-xl px-4 text-sm",
                      item.active
                        ? "bg-emerald-500/12 text-foreground hover:bg-emerald-500/18"
                        : "text-muted-foreground hover:bg-white/[0.04] hover:text-foreground"
                    )}
                  >
                    <Icon className="w-4 h-4 mr-2" />
                    {item.label}
                  </Button>
                );
              })}
          </div>

          <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-3 lg:sticky lg:top-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-white/[0.04]">
                {isSecretsPage ? (
                  <Shield className="w-4 h-4 text-red-300" />
                ) : (
                  <Database className="w-4 h-4 text-emerald-300" />
                )}
              </div>
              <div>
                <p className="font-medium text-foreground">{environmentName || "Choose environment"}</p>
                <p className="text-xs text-tertiary">Current working context</p>
              </div>
            </div>

            <div className="ml-auto flex flex-wrap gap-2">
              {canEdit && (
                <>
                  <Button
                    onClick={onBulkImport}
                    variant="outline"
                    className="text-foreground border-border hover:bg-muted"
                  >
                    <Upload className="w-4 h-4 mr-2" />
                    Bulk Import
                  </Button>
                  <Button
                    onClick={onAddVariable}
                    data-testid={isSecretsPage ? "project-secrets-primary-action" : "project-variables-primary-action"}
                    className={cn(
                      "text-foreground",
                      isSecretsPage
                        ? "bg-red-500 hover:bg-red-600"
                        : "bg-emerald-500 hover:bg-emerald-600"
                    )}
                  >
                    {isSecretsPage ? (
                      <>
                        <Shield className="w-4 h-4 mr-2" />
                        Add Secret
                      </>
                    ) : (
                      <>
                        <Plus className="w-4 h-4 mr-2" />
                        Add Variable
                      </>
                    )}
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
