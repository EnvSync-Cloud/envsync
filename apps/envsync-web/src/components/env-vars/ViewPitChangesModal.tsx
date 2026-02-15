import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  History,
  Plus,
  Edit,
  Minus,
  User,
  Calendar,
  MessageSquare,
  GitBranch,
  Clock,
  Key,
  Loader2,
  AlertCircle,
} from "lucide-react";
import { useEnvsAtPit } from "@/api/pointInTime.api";
import { useEffect } from "react";

interface ViewPitChangesModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  pitData: any;
  projectId: string;
  environmentId: string;
}

export const ViewPitChangesModal = ({
  isOpen,
  onOpenChange,
  pitData,
  projectId,
  environmentId,
}: ViewPitChangesModalProps) => {
  // Fetch the actual changes for this PiT
  const {
    data: pitStateData,
    isLoading,
    error,
    refetch,
  } = useEnvsAtPit(
    {
      app_id: projectId,
      env_type_id: environmentId,
      pit_id: pitData?.id || "",
    },
    {
      enabled: isOpen && !!pitData?.id && !!projectId && !!environmentId,
    }
  );

  // Refetch when modal opens with new data
  useEffect(() => {
    if (isOpen && pitData?.id) {
      refetch();
    }
  }, [isOpen, pitData?.id, refetch]);

  const getOperationIcon = (operation: string) => {
    switch (operation) {
      case "CREATE":
        return <Plus className="size-4 text-green-500" />;
      case "UPDATE":
        return <Edit className="size-4 text-electric_indigo-500" />;
      case "DELETE":
        return <Minus className="size-4 text-red-500" />;
      default:
        return <Clock className="size-4 text-slate-500" />;
    }
  };

  const getOperationColor = (operation: string) => {
    switch (operation) {
      case "CREATE":
        return "bg-green-500/20 text-green-300 hover:bg-green/40 border-green-500/30";
      case "UPDATE":
        return "bg-electric_indigo/20 text-electric_indigo-800 hover:bg-electric_indigo/40 border-electric_indigo/30";
      case "DELETE":
        return "bg-red-500/20 text-red-300 hover:bg-red/40 border-red-500/30";
      default:
        return "bg-slate-500/20 text-slate-300 hover:bg-slate/40 border-slate-500/30";
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return {
      date: date.toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
      }),
      time: date.toLocaleTimeString("en-US", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: true,
      }),
    };
  };

  const getUserDisplayName = (userId: string) => {
    if (userId?.includes("@")) {
      return userId.split("@")[0];
    }
    return userId || "Unknown User";
  };

  const getUserInitials = (userId: string) => {
    const displayName = getUserDisplayName(userId);
    return displayName.charAt(0).toUpperCase();
  };

  if (!pitData) {
    return null;
  }

  const dateTime = formatDate(pitData.created_at);
  const changes = pitStateData || [];

  const changeStats = {
    created: changes.filter((c) => c.operation === "CREATE").length,
    updated: changes.filter((c) => c.operation === "UPDATE").length,
    deleted: changes.filter((c) => c.operation === "DELETE").length,
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="bg-slate-800 border-slate-700 text-white max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader className="py-4 fixed top-0 bg-inherit w-full">
          <DialogTitle className="text-white text-2xl flex items-center gap-3">
            <div className="p-2 bg-purple-500/20 rounded-lg">
              <History className="w-6 h-6 text-purple-400" />
            </div>
            Point-in-Time Changes
          </DialogTitle>
          <DialogDescription className="text-slate-300 text-base">
            Detailed view of all changes made in this snapshot
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 flex-1 overflow-auto mt-24 hide-scrollbar flex flex-col">
          {/* PIT Information Header */}
          <Card className="bg-slate-700/30 border-slate-600">
            <CardContent className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-slate-400 text-sm">
                    <GitBranch className="w-4 h-4" />
                    PIT ID
                  </div>
                  <code className="text-white font-mono text-sm bg-slate-700/50 px-3 py-2 rounded-md block">
                    {pitData.id}
                  </code>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-slate-400 text-sm">
                    <Calendar className="w-4 h-4" />
                    Created On
                  </div>
                  <div className="text-white">
                    <p className="font-medium">{dateTime.date}</p>
                    <p className="text-slate-400 text-sm">{dateTime.time}</p>
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-slate-400 text-sm">
                    <User className="w-4 h-4" />
                    Created By
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 bg-gradient-to-br from-electric_indigo-500 to-purple-600 rounded-full flex items-center justify-center text-white text-xs font-medium">
                      {getUserInitials(pitData.user_id)}
                    </div>
                    <p className="text-white font-medium text-sm">
                      {getUserDisplayName(pitData.user_id)}
                    </p>
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-slate-400 text-sm">
                    <Key className="w-4 h-4" />
                    Total Changes
                  </div>
                  <p className="text-white font-bold text-lg">
                    {isLoading ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      changes.length
                    )}
                  </p>
                </div>
              </div>

              <Separator className="bg-slate-600 my-4" />

              <div className="space-y-2">
                <div className="flex items-center gap-2 text-slate-400 text-sm">
                  <MessageSquare className="w-4 h-4" />
                  Commit Message
                </div>
                <p className="text-slate-300 leading-relaxed bg-slate-700/30 p-3 rounded-lg">
                  {pitData.change_request_message}
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Loading State */}
          {isLoading && (
            <Card className="bg-slate-700/30 border-slate-600">
              <CardContent className="p-12 text-center">
                <Loader2 className="w-12 h-12 text-slate-400 mx-auto mb-4 animate-spin" />
                <p className="text-slate-400 text-lg font-medium">
                  Loading changes...
                </p>
              </CardContent>
            </Card>
          )}

          {/* Error State */}
          {error && (
            <Card className="bg-red-500/10 border-red-500/30">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <AlertCircle className="w-5 h-5 text-red-400" />
                  <p className="text-red-200 font-medium">
                    Failed to load changes: {error.message}
                  </p>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Change Statistics */}
          {!isLoading && !error && (
            <Card className="bg-slate-700/30 border-slate-600">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg text-white">
                  Change Summary
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-3 gap-4">
                  <div className="text-center p-4 bg-green-500/10 rounded-lg border border-green-500/20">
                    <div className="text-2xl font-bold text-green-400">
                      {changeStats.created}
                    </div>
                    <div className="text-sm text-green-300 flex items-center justify-center gap-1 mt-1">
                      <Plus className="w-3 h-3" />
                      Created
                    </div>
                  </div>
                  <div className="text-center p-4 bg-electric_indigo-500/10 rounded-lg border border-electric_indigo-500/20">
                    <div className="text-2xl font-bold text-electric_indigo-500">
                      {changeStats.updated}
                    </div>
                    <div className="text-sm text-electric_indigo-600 flex items-center justify-center gap-1 mt-1">
                      <Edit className="w-3 h-3" />
                      Updated
                    </div>
                  </div>
                  <div className="text-center p-4 bg-red-500/10 rounded-lg border border-red-500/20">
                    <div className="text-2xl font-bold text-red-400">
                      {changeStats.deleted}
                    </div>
                    <div className="text-sm text-red-300 flex items-center justify-center gap-1 mt-1">
                      <Minus className="w-3 h-3" />
                      Deleted
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Detailed Changes List */}
          {!isLoading && !error && (
            <Card className="flex-1 h-fit border-slate-600">
              <CardContent className="p-0 flex-1">
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg text-white">
                    Detailed Changes
                  </CardTitle>
                </CardHeader>
                <div className="space-y-0">
                  {changes.map((change, index) => (
                    <div
                      key={index}
                      className="border-b border-slate-700 last:border-b-0 p-6 hover:bg-slate-750/30 transition-colors"
                    >
                      <div className="space-y-4">
                        {/* Change Header */}
                        <div className="flex items-start justify-between">
                          <div className="flex items-center gap-3">
                            <Badge
                              className={`${getOperationColor(
                                change.operation
                              )} border font-medium px-3 py-1`}
                            >
                              {getOperationIcon(change.operation)}
                              <span className="ml-1">{change.operation}</span>
                            </Badge>
                            <code className="text-white font-mono text-sm bg-slate-700/50 px-3 py-1 rounded">
                              {change.key}
                            </code>
                          </div>
                        </div>

                        {/* Value Display */}
                        <div className="space-y-3">
                          {change.operation === "UPDATE" && (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              <div className="space-y-2">
                                <div className="flex items-center gap-2 text-slate-400 text-xs font-medium">
                                  <Minus className="w-3 h-3 text-red-400" />
                                  PREVIOUS VALUE
                                </div>
                                <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3">
                                  <code className="text-red-200 text-sm break-all">
                                    {change.key || "N/A"}
                                  </code>
                                </div>
                              </div>
                              <div className="space-y-2">
                                <div className="flex items-center gap-2 text-slate-400 text-xs font-medium">
                                  <Plus className="w-3 h-3 text-green-400" />
                                  NEW VALUE
                                </div>
                                <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-3">
                                  <code className="text-green-200 text-sm break-all">
                                    {change.value}
                                  </code>
                                </div>
                              </div>
                            </div>
                          )}

                          {change.operation === "CREATE" && (
                            <div className="space-y-2">
                              <div className="flex items-center gap-2 text-slate-400 text-xs font-medium">
                                <Plus className="w-3 h-3 text-green-400" />
                                NEW VALUE
                              </div>
                              <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-3">
                                <code className="text-green-200 text-sm break-all">
                                  {change.value}
                                </code>
                              </div>
                            </div>
                          )}

                          {change.operation === "DELETE" && (
                            <div className="space-y-2">
                              <div className="flex items-center gap-2 text-slate-400 text-xs font-medium">
                                <Minus className="w-3 h-3 text-red-400" />
                                REMOVED VALUE
                              </div>
                              <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3">
                                <code className="text-red-200 text-sm break-all">
                                  {change.value}
                                </code>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}

                  {changes.length === 0 && !isLoading && (
                    <div className="p-12 text-center">
                      <div className="flex flex-col items-center gap-4">
                        <History className="w-16 h-16 text-slate-500" />
                        <div>
                          <p className="text-slate-400 text-lg font-medium">
                            No Changes Found
                          </p>
                          <p className="text-slate-500 text-sm">
                            This point-in-time snapshot contains no variable
                            changes
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
