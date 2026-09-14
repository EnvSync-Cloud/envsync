import { useNavigate, useParams, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  Plus,
  RefreshCw,
  Upload,
  Download,
  Settings,
  MoreVertical,
  History,
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
import { appPointInTimePath } from "@/lib/app-routes";
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
  environmentTypes,
  selectedEnvironment,
  onEnvironmentChange,
  canEdit,
  isRefetching,
  onRefresh,
  onAddVariable,
  onBulkImport,
  onExport,
  onManageEnvironments,
}: ProjectHeaderProps) => {
  const navigate = useNavigate();
  const { appId } = useParams();
  const location = useLocation();

  const isPointInTimePage = /(?:^|\/)pit(?:\/|$)/.test(location.pathname);
  const isSecretsPage = location.pathname.includes("/secrets") && !isPointInTimePage;
  const currentEnv = environmentTypes.find((e) => e.id === selectedEnvironment);

  const onRollback = () => {
    if (!appId) return;
    let targetUrl = appPointInTimePath(appId);
    if (isSecretsPage) targetUrl += "/secrets";
    const envParam = currentEnv?.name?.toLowerCase() || selectedEnvironment;
    targetUrl += `?env=${encodeURIComponent(envParam)}`;
    navigate(targetUrl);
  };

  return (
    <div className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="mx-auto max-w-[1600px] px-5 md:px-6">
        <div className="flex items-center justify-end gap-4 py-3">
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
      </div>
    </div>
  );
};
