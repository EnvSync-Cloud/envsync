import { useNavigate, useParams, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
  DatabaseBackup,
  History,
} from "lucide-react";

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
  const { projectNameId } = useParams();
  const location = useLocation();

  // Determine current section based on route
  const isSecretsPage = location.pathname.includes("/secrets");
  const currentSection = isSecretsPage ? "Secrets" : "Variables";

  const handleSectionChange = (section: "environments" | "secrets") => {
    if (!projectNameId) return;

    let targetPath = `/applications/${projectNameId}`;
    if (section === "secrets") targetPath += "/secrets";
    navigate(targetPath);
  };

  const onRollback = () => {
    let targetUrl = `/applications/pit/${projectNameId}`;
    if (currentSection === "Secrets") targetUrl += "/secrets";
    const envParam = environmentName?.toLowerCase() || environmentId;
    targetUrl += `?env=${encodeURIComponent(envParam)}`;

    navigate(targetUrl);
  };

  return (
    <div className="space-y-6">
      {/* Navigation */}
      <div className="flex items-center space-x-3">
        <Button
          onClick={onBack}
          variant="ghost"
          size="sm"
          className="text-gray-400 hover:text-white hover:bg-gray-800"
        >
          <ArrowLeft className="size-4 mr-1" />
          Back to Projects
        </Button>
        <span className="text-gray-500">/</span>
        <span className="text-gray-300">{projectName}</span>
        <span className="text-gray-500">/</span>

        {/* Section Dropdown (only show when secrets are enabled) */}
        {enableSecrets ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="text-white font-medium hover:bg-gray-800 px-3 py-2 h-auto"
              >
                {isSecretsPage ? (
                  <Shield className="w-4 h-4 mr-2" />
                ) : (
                  <Settings className="w-4 h-4 mr-2" />
                )}
                {currentSection}
                <ChevronDown className="w-4 h-4 ml-2" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              className="bg-gray-900 border-gray-800 min-w-[200px]"
              align="start"
            >
              <DropdownMenuItem
                onClick={() => handleSectionChange("environments")}
                className={`text-white hover:bg-gray-800 cursor-pointer p-3 ${
                  !isSecretsPage ? "bg-gray-800" : ""
                }`}
              >
                <Settings className="w-4 h-4 mr-3 text-violet-400" />
                <div className="flex flex-col">
                  <span className="font-medium">Variables</span>
                  <span className="text-xs text-gray-400">
                    Manage variables & configuration
                  </span>
                </div>
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => handleSectionChange("secrets")}
                className={`text-white hover:bg-gray-800 cursor-pointer p-3 ${
                  isSecretsPage ? "bg-gray-800" : ""
                }`}
              >
                <Shield className="w-4 h-4 mr-3 text-red-400" />
                <div className="flex flex-col">
                  <span className="font-medium">Secrets</span>
                  <span className="text-xs text-gray-400">
                    Manage sensitive variables & credentials
                  </span>
                </div>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : (
          <span className="text-white font-medium flex items-center px-3 py-2">
            <Settings className="w-4 h-4 mr-2" />
            {currentSection}
          </span>
        )}
      </div>

      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-3 mb-2">
            <div className="w-10 h-10 bg-gradient-to-br from-violet-500/20 to-indigo-500/20 rounded-lg flex items-center justify-center">
              <Database className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-white">{projectName}</h1>
              <p className="text-gray-400">
                {isSecretsPage
                  ? "Sensitive Variables & Credentials Management"
                  : "Variables & Configuration"}
              </p>
            </div>
          </div>

          {/* Statistics */}
          <div className="flex items-center space-x-4 mt-3">
            {!isSecretsPage ? (
              <>
                <Badge
                  variant="secondary"
                  className="bg-gray-800 text-gray-300"
                >
                  {totalVariables} Variables
                </Badge>
                <Badge
                  variant="secondary"
                  className="bg-gray-800 text-gray-300"
                >
                  {totalSecrets} Secrets
                </Badge>
                <Badge
                  variant="secondary"
                  className="bg-violet-500/10 text-violet-400"
                >
                  {environmentTypes} Environments
                </Badge>
              </>
            ) : (
              <>
                <Badge
                  variant="secondary"
                  className="bg-red-500/20 text-red-400"
                >
                  <Shield className="w-3 h-3 mr-1" />
                  {totalSecrets} Secrets
                </Badge>
                <Badge
                  variant="secondary"
                  className="bg-gray-800 text-gray-300"
                >
                  {totalVariables} Total Variables
                </Badge>
                <Badge
                  variant="secondary"
                  className="bg-violet-500/10 text-violet-400"
                >
                  {environmentTypes} Environments
                </Badge>
              </>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center space-x-3">
          {/* Options Dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="text-gray-400 border-gray-700 hover:bg-gray-800"
              >
                <MoreVertical className="w-4 h-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              className="bg-gray-900 border-gray-800 min-w-[160px]"
              align="end"
            >
              <DropdownMenuItem
                onClick={onRefresh}
                disabled={isRefetching}
                className="text-white hover:bg-gray-800 cursor-pointer"
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
                className="text-white hover:bg-gray-800 cursor-pointer"
              >
                <Download className="w-4 h-4 mr-2" />
                Export
              </DropdownMenuItem>
              {!isSecretsPage && (
                <DropdownMenuItem
                  onClick={onRollback}
                  className="text-white hover:bg-gray-800 cursor-pointer"
              >
                <History className="w-4 h-4 mr-2" />
                Recovery
              </DropdownMenuItem>)}
              {canEdit && (
                <DropdownMenuItem
                  onClick={onManageEnvironments}
                  className="text-white hover:bg-gray-800 cursor-pointer"
                >
                  <Settings className="w-4 h-4 mr-2" />
                  Manage Environments
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>

          {canEdit && (
            <>
              <Button
                onClick={onBulkImport}
                variant="outline"
                className="text-white border-gray-700 hover:bg-gray-800"
              >
                <Upload className="w-4 h-4 mr-2" />
                Bulk Import
              </Button>

              <Button
                onClick={onAddVariable}
                className={`text-white ${
                  isSecretsPage
                    ? "bg-red-500 hover:bg-red-600"
                    : "bg-violet-500 hover:bg-violet-600"
                }`}
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
  );
};
