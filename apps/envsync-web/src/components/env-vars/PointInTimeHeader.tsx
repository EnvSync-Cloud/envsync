import { useState } from "react";
import {
  useNavigate,
  useParams,
  useLocation,
  useSearchParams,
} from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ArrowLeft,
  Plus,
  RefreshCw,
  Upload,
  Download,
  Settings,
  ChevronDown,
  Shield,
  MoreVertical,
  Clock,
  Database,
} from "lucide-react";
import { EnvironmentType } from "@/constants";
import { Card, CardContent } from "@/components/ui/card";

interface PointInTimeHeaderProps {
  projectName: string;
  environmentName?: string;
  environmentTypes: EnvironmentType[];
  selectedEnvironmentId?: string;
  canEdit: boolean;
  isRefetching: boolean;
  enableSecrets?: boolean;
  onBack: () => void;
  onRefresh: () => void;
  onAddVariable: () => void;
  onBulkImport: () => void;
  onExport: () => void;
  onManageEnvironments: () => void;
  onEnvironmentChange?: (environmentId: string) => void;
}

export const PointInTimeHeader = ({
  projectName,
  //   environmentName = "",
  environmentTypes = [],
  selectedEnvironmentId,
  canEdit,
  isRefetching,
  enableSecrets,
  onBack,
  onRefresh,
  onAddVariable,
  onBulkImport,
  onExport,
  onManageEnvironments,
  onEnvironmentChange,
}: PointInTimeHeaderProps) => {
  const navigate = useNavigate();
  const { projectNameId, environmentNameId } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const location = useLocation();

  const selectedEnvId = searchParams.get("env") || environmentNameId;
  const [currentEnv, setCurrentEnv] = useState<EnvironmentType | undefined>(
    environmentTypes.find((env) => env.id === selectedEnvId) ||
      environmentTypes[0]
  );

  // Determine current section based on route
  const isSecretsPage = location.pathname.includes("/secrets");
  const currentSection = isSecretsPage ? "Secrets" : "Variables";

  const handleSectionChange = (section: "environments" | "secrets") => {
    if (!projectNameId) return;

    let targetUrl = `/applications/pit/${projectNameId}`;
    if (section === "secrets") targetUrl += "/secrets";
    const envName = currentEnv?.name?.toLowerCase() || selectedEnvId;
    targetUrl += `?env=${encodeURIComponent(envName)}`;

    navigate(targetUrl);
  };

  const handleEnvironmentChange = (envId: string) => {
    onEnvironmentChange?.(envId);
    const env = environmentTypes.find((env) => env.id === envId);
    setCurrentEnv(env);
    setSearchParams({ env: env?.name?.toLowerCase() || envId });
  };

  const getEnvironmentColor = (color?: string) => {
    if (!color) return "bg-gray-500";

    // Handle hex colors
    if (color.startsWith("#")) {
      return `bg-[${color}]`;
    }

    // Handle named colors
    const colors: { [key: string]: string } = {
      red: "bg-red-500",
      yellow: "bg-yellow-500",
      blue: "bg-indigo-500",
      green: "bg-green-500",
      purple: "bg-purple-500",
      orange: "bg-orange-500",
    };
    return colors[color] || "bg-gray-500";
  };

  return (
    <div className="space-y-6">
      {/* Enhanced Navigation Breadcrumb */}
      <Card className="bg-gray-900/50 border-gray-800 backdrop-blur-sm">
        <CardContent className="p-4">
          <div className="flex items-center space-x-3">
            <Button
              onClick={onBack}
              variant="ghost"
              size="sm"
              className="text-gray-400 hover:text-white hover:bg-gray-800 transition-colors"
            >
              <ArrowLeft className="size-4 mr-2" />
              Back to Projects
            </Button>
            <div className="flex items-center space-x-2 text-gray-500">
              <span>/</span>
              <Database className="w-4 h-4" />
            </div>
            <span className="text-gray-300 font-medium">{projectName}</span>
            <span className="text-gray-500">/</span>

            {/* Section Dropdown (only show when secrets are enabled) */}
            {enableSecrets ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-white font-medium hover:bg-gray-800 px-4 py-2 h-auto border border-gray-700 hover:border-gray-500 transition-all"
                  >
                    <div className="flex items-center gap-2">
                      {isSecretsPage ? (
                        <Shield className="w-4 h-4 text-red-400" />
                      ) : (
                        <Clock className="w-4 h-4 text-indigo-400" />
                      )}
                      <span>{currentSection} PIT</span>
                      <ChevronDown className="w-4 h-4 ml-1" />
                    </div>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  className="bg-gray-900 border-gray-800 min-w-[250px] shadow-xl"
                  align="start"
                >
                  <DropdownMenuItem
                    onClick={() => handleSectionChange("environments")}
                    className={`text-white hover:bg-gray-800 cursor-pointer p-4 ${
                      !isSecretsPage ? "bg-gray-800/50" : ""
                    }`}
                  >
                    <Clock className="w-5 h-5 mr-3 text-indigo-400" />
                    <div className="flex flex-col">
                      <span className="font-medium">Variables</span>
                      <span className="text-xs text-gray-400">
                        View point-in-time snapshots of variables
                      </span>
                    </div>
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => handleSectionChange("secrets")}
                    className={`text-white hover:bg-gray-800 cursor-pointer p-4 ${
                      isSecretsPage ? "bg-gray-800/50" : ""
                    }`}
                  >
                    <Shield className="w-5 h-5 mr-3 text-red-400" />
                    <div className="flex flex-col">
                      <span className="font-medium">Secrets</span>
                      <span className="text-xs text-gray-400">
                        View point-in-time snapshots of secret values
                      </span>
                    </div>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <span className="text-white font-medium flex items-center gap-2 px-4 py-2">
                <Clock className="w-4 h-4 text-indigo-400" />
                {currentSection} PIT
              </span>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Enhanced Header */}
      <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
        <div className="flex-1 space-y-4">
          <div className="space-y-2 flex justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-gradient-to-br from-indigo-500/20 to-purple-600/20 rounded-xl">
                <Clock className="w-6 h-6 text-indigo-400" />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-white">{projectName}</h1>
                <p className="text-gray-400 text-lg">
                  {isSecretsPage
                    ? "Point-in-time snapshots for secrets"
                    : "Point-in-time snapshots for variables"}
                </p>
              </div>
            </div>
            {/* Enhanced Actions */}
            <div className="flex items-center space-x-3">
              {/* Enhanced Environment Type Selector */}
              {environmentTypes.length > 0 && (
                <Select
                  value={currentEnv.id}
                  onValueChange={handleEnvironmentChange}
                >
                  <SelectTrigger className="w-64 bg-gray-800 border-gray-700 text-white hover:bg-gray-700 transition-colors">
                    <SelectValue>
                      {currentEnv && (
                        <div className="flex items-center space-x-3">
                          <div
                            className="w-3 h-3 rounded-full"
                            style={{
                              backgroundColor: currentEnv.color || "#6366f1",
                            }}
                          />
                          <span className="font-medium">{currentEnv.name}</span>
                          {currentEnv.is_protected && (
                            <Shield className="w-3 h-3 text-red-400" />
                          )}
                          {currentEnv.is_default && (
                            <Badge className="bg-indigo-600 text-indigo-100 text-xs px-2 py-0.5">
                              Default
                            </Badge>
                          )}
                        </div>
                      )}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent className="bg-gray-900 border-gray-800 shadow-xl">
                    {environmentTypes.map((env) => (
                      <SelectItem
                        key={env.id}
                        value={env.id}
                        className="text-white hover:bg-gray-800 p-3"
                      >
                        <div className="flex items-center space-x-3">
                          <div
                            className="w-3 h-3 rounded-full"
                            style={{
                              backgroundColor: env.color || "#6366f1",
                            }}
                          />
                          <span className="font-medium">{env.name}</span>
                          {env.is_protected && (
                            <Shield className="w-3 h-3 text-red-400" />
                          )}
                          {env.is_default && (
                            <Badge className="bg-indigo-600 text-indigo-100 text-xs px-2 py-0.5">
                              Default
                            </Badge>
                          )}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              {/* Quick Actions */}
              <div className="flex items-center space-x-2">
                <Button
                  onClick={onRefresh}
                  variant="outline"
                  size="sm"
                  disabled={isRefetching}
                  className="text-gray-300 border-gray-700 hover:bg-gray-800 hover:text-white transition-colors"
                >
                  <RefreshCw
                    className={`w-4 h-4 mr-2 ${
                      isRefetching ? "animate-spin" : ""
                    }`}
                  />
                  Refresh
                </Button>

                <Button
                  onClick={onExport}
                  variant="outline"
                  size="sm"
                  className="text-gray-300 border-gray-700 hover:bg-gray-800 hover:text-white transition-colors"
                >
                  <Download className="w-4 h-4 mr-2" />
                  Export
                </Button>
              </div>

              {/* More Options Dropdown */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-gray-400 border-gray-700 hover:bg-gray-800 hover:text-white transition-colors"
                  >
                    <MoreVertical className="w-4 h-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  className="bg-gray-900 border-gray-800 min-w-[180px] shadow-xl"
                  align="end"
                >
                  {canEdit && (
                    <>
                      <DropdownMenuItem
                        onClick={onBulkImport}
                        className="text-white hover:bg-gray-800 cursor-pointer p-3"
                      >
                        <Upload className="w-4 h-4 mr-3 text-green-400" />
                        Bulk Import
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={onAddVariable}
                        className="text-white hover:bg-gray-800 cursor-pointer p-3"
                      >
                        {isSecretsPage ? (
                          <>
                            <Shield className="w-4 h-4 mr-3 text-red-400" />
                            Add Secret
                          </>
                        ) : (
                          <>
                            <Plus className="w-4 h-4 mr-3 text-violet-400" />
                            Add Variable
                          </>
                        )}
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={onManageEnvironments}
                        className="text-white hover:bg-gray-800 cursor-pointer p-3"
                      >
                        <Settings className="w-4 h-4 mr-3 text-indigo-400" />
                        Manage Environments
                      </DropdownMenuItem>
                    </>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
