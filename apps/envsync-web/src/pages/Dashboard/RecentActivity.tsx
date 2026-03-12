import { Link } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { formatLastUsed } from "@/lib/utils";

interface RecentActivityProps {
  auditLogs: Array<{
    id?: string;
    action?: string;
    user_email?: string;
    created_at?: string;
    metadata?: Record<string, unknown>;
  }>;
  isLoading: boolean;
}

function getActionColor(action: string) {
  if (action.includes("created") || action.includes("create")) return "bg-green-500/10 text-green-400 border-green-500/20";
  if (action.includes("updated") || action.includes("update")) return "bg-violet-500/10 text-violet-400 border-violet-500/20";
  if (action.includes("deleted") || action.includes("delete")) return "bg-red-500/10 text-red-400 border-red-500/20";
  if (action.includes("viewed") || action.includes("view")) return "bg-gray-500/10 text-gray-400 border-gray-500/20";
  return "bg-blue-500/10 text-blue-400 border-blue-500/20";
}

function formatAction(action: string) {
  return action
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export function RecentActivity({ auditLogs, isLoading }: RecentActivityProps) {
  return (
    <div className="overflow-y-auto h-full space-y-3 pr-1 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
      {isLoading ? (
        Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="flex items-start space-x-3">
            <Skeleton className="w-6 h-6 rounded-full bg-gray-800" />
            <div className="flex-1 space-y-1">
              <Skeleton className="h-3 w-full bg-gray-800" />
              <Skeleton className="h-3 w-20 bg-gray-800" />
            </div>
          </div>
        ))
      ) : auditLogs.length === 0 ? (
        <p className="text-sm text-gray-500 text-center py-4">
          No recent activity
        </p>
      ) : (
        <>
          {auditLogs.map((log, idx) => (
            <div
              key={log.id ?? idx}
              className="flex items-start space-x-3 py-1.5"
            >
              <div className="w-6 h-6 rounded-full bg-gray-800 flex items-center justify-center flex-shrink-0 mt-0.5">
                <span className="text-[10px] text-gray-400 font-medium">
                  {log.user_email?.charAt(0)?.toUpperCase() || "?"}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center space-x-2">
                  <Badge
                    variant="outline"
                    className={`text-[10px] px-1.5 py-0 ${getActionColor(
                      log.action ?? ""
                    )}`}
                  >
                    {formatAction(log.action ?? "unknown")}
                  </Badge>
                </div>
                <p className="text-[11px] text-gray-500 mt-0.5 truncate">
                  {log.user_email}
                  {log.created_at && (
                    <span className="ml-1">
                      · {formatLastUsed(log.created_at)}
                    </span>
                  )}
                </p>
              </div>
            </div>
          ))}
          <Link
            to="/audit"
            className="block text-xs text-violet-400 hover:text-violet-300 pt-2 transition-colors"
          >
            View all activity →
          </Link>
        </>
      )}
    </div>
  );
}
