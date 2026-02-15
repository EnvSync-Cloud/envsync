import { useParams, useSearchParams } from "react-router-dom";
import { PointInTimeHeader } from "@/components/env-vars/PointInTimeHeader";
import { Button } from "@/components/ui/button";
import {
  ArrowRight,
  GitCompare,
  History,
  MoreVertical,
  RotateCcw,
  Clock,
  User,
  Calendar,
  MessageSquare,
  Eye,
  GitBranch,
  AlertCircle,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useCallback, useState, useMemo } from "react";
import { CheckDiffModal } from "@/components/env-vars/CheckDiffModal";
import { ViewPitChangesModal } from "@/components/env-vars/ViewPitChangesModal";
import { useNavigate } from "react-router-dom";
import { useProjectEnvironments } from "@/hooks/useProjectEnvironments";
import { PointInTimeLoadingPage } from "./loading";
import { PointInTimeErrorPage } from "./error";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  usePointInTimeHistory,
  usePointInTimeRollback,
} from "@/api/pointInTime.api";
import { Alert, AlertDescription } from "@/components/ui/alert";

// Updated interface to match API response structure
export interface PitHistoryItem {
  id: string;
  change_request_message: string;
  user_id: string;
  created_at: string;
  updated_at: string;
  org_id: string;
  app_id: string;
  env_type_id: string;
}

export interface PitChangeRequest {
  id: string;
  env_store_pit_id: string;
  key: string;
  value: string;
  operation: "CREATE" | "UPDATE" | "DELETE";
  created_at: string;
  updated_at: string;
}

export interface PitWithChanges extends PitHistoryItem {
  changes?: PitChangeRequest[];
  changes_count?: number;
}

const PointInTime = () => {
  const navigate = useNavigate();
  const { projectNameId, environmentNameId } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();

  // Get selected environment from URL params or default to first environment
  const selectedEnvId = searchParams.get("env") || environmentNameId;

  const [isCheckDiffModalOpen, setIsCheckDiffModalOpen] = useState(false);
  const [isViewPitChangesModalOpen, setIsViewPitChangesModalOpen] =
    useState(false);
  const [selectedPitData, setSelectedPitData] = useState<PitWithChanges | null>(
    null
  );
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize] = useState(20);

  // Get project and environment data
  const {
    project,
    environmentTypes,
    enableSecrets,
    isLoading: isProjectLoading,
    error: projectError,
    refetch: refetchProject,
  } = useProjectEnvironments(projectNameId);

  // Find the selected environment
  const selectedEnvironment = useMemo(() => {
    console.log(environmentTypes);
    if (!environmentTypes || !selectedEnvId) return null;
    return (
      environmentTypes.find(
        (env) =>
          env.id === selectedEnvId ||
          env.name.toLowerCase() === selectedEnvId.toLowerCase()
      ) || environmentTypes[0]
    );
  }, [environmentTypes, selectedEnvId]);

  // Get point-in-time history
  const {
    data: historyData,
    isLoading: isHistoryLoading,
    error: historyError,
    refetch: refetchHistory,
    isRefetching,
  } = usePointInTimeHistory(
    {
      app_id: projectNameId || "",
      env_type_id: selectedEnvironment?.id || "",
      page: currentPage,
      per_page: pageSize,
    },
    {
      enabled: !!projectNameId && !!selectedEnvironment?.id,
      staleTime: 30000, // 30 seconds
    }
  );

  // Rollback mutations
  const { rollbackToPit } = usePointInTimeRollback();

  const handleRetry = useCallback(() => {
    refetchProject();
    refetchHistory();
  }, [refetchProject, refetchHistory]);

  const onBack = () => navigate(-1);

  // Handle environment change
  const handleEnvironmentChange = useCallback(
    (envId: string) => {
      const env = environmentTypes?.find((e) => e.id === envId);
      setSearchParams((prev) => {
        const newParams = new URLSearchParams(prev);
        newParams.set("env", env?.name?.toLowerCase() || envId);
        return newParams;
      });
      setCurrentPage(1); // Reset to first page when changing environment
      setSelectedPitData(null); // Clear selected PiT when changing environment
    },
    [setSearchParams, environmentTypes]
  );

  // Handle page change
  const handlePageChange = useCallback((page: number) => {
    setCurrentPage(page);
  }, []);

  // Handle refresh
  const handleRefresh = useCallback(() => {
    refetchHistory();
  }, [refetchHistory]);

  const handleRollback = useCallback(
    (pitData: PitHistoryItem) => {
      if (!projectNameId || !selectedEnvironment?.id) return;

      const confirmMessage = `Are you sure you want to rollback to PIT ${pitData.id}?\n\nThis will restore all variables to their state at that point in time.\n\nMessage: ${pitData.change_request_message}`;

      if (window.confirm(confirmMessage)) {
        rollbackToPit.mutate({
          app_id: projectNameId,
          env_type_id: selectedEnvironment.id,
          pit_id: pitData.id,
          rollback_message: `Rollback to PIT ${pitData.id} via dashboard`,
        });
      }
    },
    [projectNameId, selectedEnvironment?.id, rollbackToPit]
  );

  const handleViewChanges = useCallback((pitData: PitHistoryItem) => {
    setSelectedPitData(pitData);
    setIsViewPitChangesModalOpen(true);
  }, []);

  const handleCheckDiff = useCallback((pitData: PitHistoryItem) => {
    setSelectedPitData(pitData);
    setIsCheckDiffModalOpen(true);
  }, []);

  // Loading state
  if (isProjectLoading || isHistoryLoading) {
    return <PointInTimeLoadingPage />;
  }

  // Error state
  if (projectError || historyError) {
    return (
      <PointInTimeErrorPage
        error={projectError || historyError}
        onRetry={handleRetry}
        onBack={onBack}
      />
    );
  }

  // No environment selected or found
  if (!selectedEnvironment) {
    return (
      <PointInTimeErrorPage
        error={new Error("No environment found")}
        onRetry={handleRetry}
        onBack={onBack}
      />
    );
  }

  // Extract PiT history from API response
  const pitHistory: PitHistoryItem[] = historyData?.pits || [];
  const totalPages = historyData?.totalPages || 1;

  // Set default selected PIT data to the first item
  const currentSelectedPit =
    selectedPitData || (pitHistory.length > 0 ? pitHistory[0] : null);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return {
      date: date.toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
      }),
      time: date.toLocaleTimeString("en-US", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
      }),
    };
  };

  const getOperationColor = (operation: string) => {
    switch (operation) {
      case "CREATE":
        return "bg-green-500/20 text-green-400 border-green-500/30";
      case "UPDATE":
        return "bg-electric_indigo-500/20 text-electric_indigo-400 border-electric_indigo-500/30";
      case "DELETE":
        return "bg-red-500/20 text-red-400 border-red-500/30";
      default:
        return "bg-slate-500/20 text-slate-300 border-slate-500/30";
    }
  };

  const getOperationIcon = (operation: string) => {
    switch (operation) {
      case "CREATE":
        return <GitBranch className="w-3 h-3" />;
      case "UPDATE":
        return <Clock className="w-3 h-3" />;
      case "DELETE":
        return <RotateCcw className="w-3 h-3" />;
      default:
        return <Clock className="w-3 h-3" />;
    }
  };

  const getUserDisplayName = (userId: string) => {
    // Extract email or name from user_id
    if (userId.includes("@")) {
      return userId.split("@")[0];
    }
    return userId;
  };

  const getUserInitials = (userId: string) => {
    const displayName = getUserDisplayName(userId);
    return displayName.charAt(0).toUpperCase();
  };

  return (
    <div className="flex flex-col gap-6 p-6">
      <PointInTimeHeader
        projectName={project?.name || projectNameId || ""}
        environmentName={selectedEnvironment.name}
        environmentTypes={environmentTypes || []}
        selectedEnvironmentId={selectedEnvironment.id}
        canEdit={false}
        isRefetching={isRefetching}
        enableSecrets={enableSecrets}
        onBack={onBack}
        onRefresh={handleRefresh}
        onAddVariable={() => {}}
        onBulkImport={() => {}}
        onExport={() => {}}
        onManageEnvironments={() => {}}
        onEnvironmentChange={handleEnvironmentChange}
      />

      {/* Empty State */}
      {pitHistory.length === 0 && !isHistoryLoading && (
        <Card className="bg-slate-800 border-slate-700">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <div className="p-4 bg-slate-700/50 rounded-full mb-4">
              <History className="w-8 h-8 text-slate-400" />
            </div>
            <h3 className="text-lg font-semibold text-white mb-2">
              No Point-in-Time History
            </h3>
            <p className="text-slate-400 text-center max-w-md">
              No variable changes have been recorded yet. Start making changes
              to see the point-in-time history here.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Current PIT Overview Card */}
      {currentSelectedPit && (
        <Card className="bg-gradient-to-br from-slate-800 to-slate-900 border-slate-700 shadow-xl">
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-electric_indigo-500/20 rounded-lg">
                  <Clock className="w-5 h-5 text-electric_indigo-400" />
                </div>
                <div>
                  <h2 className="text-xl font-semibold text-white">
                    Selected Point in Time
                  </h2>
                  <p className="text-slate-400 text-sm">
                    Snapshot details and metadata
                  </p>
                </div>
              </div>
              <Badge className="bg-electric_indigo-500/20 text-electric_indigo-400 border-electric_indigo-500/30 border font-medium">
                <Clock className="w-3 h-3 mr-1" />
                SNAPSHOT
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-slate-400 text-sm">
                  <GitBranch className="w-4 h-4" />
                  PIT ID
                </div>
                <p className="text-white font-mono text-sm bg-slate-700/50 px-3 py-2 rounded-md">
                  {currentSelectedPit.id}
                </p>
              </div>
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-slate-400 text-sm">
                  <Calendar className="w-4 h-4" />
                  Created On
                </div>
                <div className="text-white">
                  <p className="font-medium">
                    {formatDate(currentSelectedPit.created_at).date}
                  </p>
                  <p className="text-slate-400 text-sm">
                    {formatDate(currentSelectedPit.created_at).time}
                  </p>
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-slate-400 text-sm">
                  <User className="w-4 h-4" />
                  Created By
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 bg-gradient-to-br from-electric_indigo-500 to-purple-600 rounded-full flex items-center justify-center text-white text-xs font-medium">
                    {getUserInitials(currentSelectedPit.user_id)}
                  </div>
                  <p className="text-white font-medium">
                    {getUserDisplayName(currentSelectedPit.user_id)}
                  </p>
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-slate-400 text-sm">
                  <MessageSquare className="w-4 h-4" />
                  Change Message
                </div>
                <p className="text-slate-300 text-sm leading-relaxed">
                  {currentSelectedPit.change_request_message}
                </p>
              </div>
            </div>

            <Separator className="bg-slate-700" />

            <div className="flex justify-between items-center">
              <div className="flex items-center gap-4">
                <Button
                  variant="outline"
                  className="text-slate-300 border-slate-600 hover:bg-slate-700"
                  onClick={() => handleCheckDiff(currentSelectedPit)}
                >
                  <GitCompare className="w-4 h-4 mr-2" />
                  Compare Changes
                </Button>
                <Button
                  variant="outline"
                  className="text-orange-300 border-orange-600 hover:bg-orange-900/20"
                  onClick={() => handleRollback(currentSelectedPit)}
                  disabled={rollbackToPit.isPending}
                >
                  {rollbackToPit.isPending ? (
                    <>
                      <div className="w-4 h-4 mr-2 border-2 border-orange-400 border-t-transparent rounded-full animate-spin" />
                      Rolling back...
                    </>
                  ) : (
                    <>
                      <RotateCcw className="w-4 h-4 mr-2" />
                      Rollback to this PIT
                    </>
                  )}
                </Button>
              </div>
              <Button
                className="bg-electric_indigo-600 hover:bg-electric_indigo-700 text-white shadow-lg"
                onClick={() => handleViewChanges(currentSelectedPit)}
              >
                <Eye className="w-4 h-4 mr-2" />
                View Changes
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* PIT History Timeline */}
      <Card className="bg-slate-800 border-slate-700 shadow-lg">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-500/20 rounded-lg">
                <History className="w-5 h-5 text-purple-400" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-white">
                  Point-in-Time History
                </h3>
                <p className="text-slate-400 text-sm">
                  Complete timeline of variable changes for{" "}
                  {selectedEnvironment.name}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Badge
                variant="outline"
                className="text-slate-300 border-slate-600"
              >
                {historyData?.pits.length || pitHistory.length} total snapshots
              </Badge>
              {totalPages > 1 && (
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handlePageChange(currentPage - 1)}
                    disabled={currentPage <= 1 || isRefetching}
                    className="text-slate-300 border-slate-600 hover:bg-slate-700"
                  >
                    Previous
                  </Button>
                  <span className="text-slate-400 text-sm">
                    Page {currentPage} of {totalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handlePageChange(currentPage + 1)}
                    disabled={currentPage >= totalPages || isRefetching}
                    className="text-slate-300 border-slate-600 hover:bg-slate-700"
                  >
                    Next
                  </Button>
                </div>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="space-y-0">
            {pitHistory.map((pitData, index) => {
              const dateTime = formatDate(pitData.created_at);
              const isSelected = selectedPitData?.id === pitData.id;

              return (
                <div
                  key={pitData.id}
                  className={`relative flex items-center p-6 border-b border-slate-700 last:border-b-0 transition-all duration-200 ${
                    isSelected
                      ? "bg-electric_indigo-500/10 border-l-4 border-l-electric_indigo-500"
                      : "hover:bg-slate-750 cursor-pointer"
                  }`}
                  onClick={() => setSelectedPitData(pitData)}
                >
                  {/* Timeline indicator */}
                  <div className="absolute left-0 top-1/2 transform -translate-y-1/2 w-1 h-12 bg-gradient-to-b from-transparent via-slate-600 to-transparent"></div>

                  <div className="flex-1 grid grid-cols-1 md:grid-cols-12 gap-4 items-center">
                    {/* PIT ID & Timestamp */}
                    <div className="md:col-span-3 space-y-1">
                      <div className="flex items-center gap-2">
                        <code className="text-white font-mono text-sm bg-slate-700/50 px-2 py-1 rounded">
                          {pitData.id.slice(0, 8)}...
                        </code>
                        <Badge className="bg-purple-500/20 text-purple-300 border-purple-500/30 border text-xs">
                          <Clock className="w-3 h-3 mr-1" />
                          PIT
                        </Badge>
                      </div>
                    </div>

                    {/* Date & Time */}
                    <div className="md:col-span-2 space-y-1">
                      <p className="text-white font-medium text-sm">
                        {dateTime.date}
                      </p>
                      <p className="text-slate-400 text-xs">{dateTime.time}</p>
                    </div>

                    {/* User */}
                    <div className="md:col-span-2">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 bg-gradient-to-br from-electric_indigo-500 to-purple-600 rounded-full flex items-center justify-center text-white text-xs font-medium">
                          {getUserInitials(pitData.user_id)}
                        </div>
                        <p className="text-slate-300 text-sm truncate">
                          {getUserDisplayName(pitData.user_id)}
                        </p>
                      </div>
                    </div>

                    {/* Message */}
                    <div className="md:col-span-4">
                      <p className="text-slate-300 text-sm line-clamp-2 leading-relaxed">
                        {pitData.change_request_message}
                      </p>
                    </div>

                    {/* Actions */}
                    <div className="md:col-span-1 flex justify-end">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0 hover:bg-slate-600 text-slate-400 hover:text-white"
                          >
                            <MoreVertical className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent
                          className="bg-slate-800 border-slate-700 min-w-[180px]"
                          align="end"
                        >
                          <DropdownMenuItem
                            onClick={(e) => {
                              e.stopPropagation();
                              handleRollback(pitData);
                            }}
                            className="text-white hover:bg-slate-700 cursor-pointer"
                            disabled={rollbackToPit.isPending}
                          >
                            <RotateCcw className="w-4 h-4 mr-2 text-orange-400" />
                            Rollback to this PIT
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={(e) => {
                              e.stopPropagation();
                              handleViewChanges(pitData);
                            }}
                            className="text-white hover:bg-slate-700 cursor-pointer"
                          >
                            <History className="w-4 h-4 mr-2 text-electric_indigo-400" />
                            View Changes
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={(e) => {
                              e.stopPropagation();
                              handleCheckDiff(pitData);
                            }}
                            className="text-white hover:bg-slate-700 cursor-pointer"
                          >
                            <GitCompare className="w-4 h-4 mr-2 text-green-400" />
                            Compare Changes
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>

                  {/* Selection indicator */}
                  {isSelected && (
                    <div className="absolute right-4 top-1/2 transform -translate-y-1/2">
                      <div className="w-2 h-2 bg-electric_indigo-500 rounded-full animate-pulse"></div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Rollback Status Alert */}
      {rollbackToPit.isPending && (
        <Alert className="bg-orange-500/10 border-orange-500/30">
          <AlertCircle className="h-4 w-4 text-orange-400" />
          <AlertDescription className="text-orange-200">
            Rolling back variables... This may take a few moments.
          </AlertDescription>
        </Alert>
      )}

      {/* Modals */}
      <CheckDiffModal
        isOpen={isCheckDiffModalOpen}
        onOpenChange={setIsCheckDiffModalOpen}
        pitData={selectedPitData}
        pitIdList={pitHistory.map((pit) => pit.id)}
        projectId={projectNameId || ""}
        environmentId={selectedEnvironment.id}
      />

      <ViewPitChangesModal
        isOpen={isViewPitChangesModalOpen}
        onOpenChange={setIsViewPitChangesModalOpen}
        pitData={selectedPitData}
        projectId={projectNameId || ""}
        environmentId={selectedEnvironment.id}
      />
    </div>
  );
};

export default PointInTime;
