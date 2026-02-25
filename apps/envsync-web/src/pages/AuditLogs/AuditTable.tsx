import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Activity,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Plus,
  Edit,
  Trash2,
  Eye,
  Shield,
  Terminal,
  Database,
  Settings,
  Users,
  Building,
  Key,
  FileText,
} from "lucide-react";
import { AuditActions } from "@/lib/audit.type";
import { AuditLog, AuditLogRow } from "@/components/audit/row";
import { AuditLogRowSkeleton } from "@/components/audit/loading";
import { PAGE_SIZE_OPTIONS } from "@/hooks/useAuditLogs";

interface AuditTableProps {
  displayData: AuditLog[];
  isLoading: boolean;
  isEmpty: boolean;
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
  paginationInfo: {
    startItem: number;
    endItem: number;
    hasNextPage: boolean;
    hasPrevPage: boolean;
    pageNumbers: (number | string)[];
  };
  debouncedSearchQuery: string;
  filterOptions: {
    action: string;
    user: string;
    timeRange: string;
    resourceType: string;
  };
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: string) => void;
  onResetFilters: () => void;
  getActionDescription: (action: AuditActions) => string;
  getActionCategory: (action: AuditActions) => string;
  getActionBadgeColor: (action: AuditActions) => string;
  getResourceTypeFromAction: (action: AuditActions) => string;
}

function getActionIcon(category: string) {
  const iconClass = "size-4 stroke-1";
  switch (category) {
    case "create":
      return <Plus className={iconClass} />;
    case "update":
      return <Edit className={iconClass} />;
    case "delete":
      return <Trash2 className={iconClass} />;
    case "view":
      return <Eye className={iconClass} />;
    case "auth":
      return <Shield className={iconClass} />;
    case "cli":
      return <Terminal className={iconClass} />;
    default:
      return <Activity className={iconClass} />;
  }
}

function getResourceIcon(resourceType: string) {
  const iconClass = "size-6 stroke-1";
  switch (resourceType) {
    case "app":
      return <Database className={iconClass} />;
    case "env":
      return <Settings className={iconClass} />;
    case "user":
      return <Users className={iconClass} />;
    case "org":
      return <Building className={iconClass} />;
    case "api_key":
      return <Key className={iconClass} />;
    case "cli":
      return <Terminal className={iconClass} />;
    default:
      return <FileText className={iconClass} />;
  }
}

export function AuditTable({
  displayData,
  isLoading,
  isEmpty,
  pagination,
  paginationInfo,
  debouncedSearchQuery,
  filterOptions,
  onPageChange,
  onPageSizeChange,
  onResetFilters,
  getActionDescription,
  getActionCategory,
  getActionBadgeColor,
  getResourceTypeFromAction,
}: AuditTableProps) {
  return (
    <Card className="bg-card text-card-foreground bg-gradient-to-br from-gray-900 to-gray-950 border-gray-800 shadow-xl">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium text-gray-300 flex items-center justify-between">
          <span>Activity Log</span>
          {pagination.total > 0 && (
            <span className="text-xs text-gray-500 font-normal">
              {paginationInfo.startItem}-{paginationInfo.endItem} of{" "}
              {pagination.total}
            </span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isEmpty ? (
          <div className="text-center py-12">
            <Activity className="w-10 h-10 text-gray-700 mx-auto mb-3" />
            <h3 className="text-sm font-medium text-gray-300 mb-1">
              No audit logs found
            </h3>
            <p className="text-xs text-gray-500 mb-4">
              {debouncedSearchQuery ||
              Object.values(filterOptions).some(
                (v) => v !== "all" && v !== "all_time"
              )
                ? "No logs match your current filters"
                : "No audit logs available"}
            </p>
            {(debouncedSearchQuery ||
              Object.values(filterOptions).some(
                (v) => v !== "all" && v !== "all_time"
              )) && (
              <Button
                onClick={onResetFilters}
                variant="outline"
                size="sm"
                className="text-gray-400 border-gray-700 hover:bg-gray-800"
              >
                Clear Filters
              </Button>
            )}
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-800">
                    <th className="text-left py-2.5 px-4 text-xs text-gray-500 font-medium">
                      User
                    </th>
                    <th className="text-left py-2.5 px-4 text-xs text-gray-500 font-medium">
                      Resource
                    </th>
                    <th className="text-left py-2.5 px-4 text-xs text-gray-500 font-medium">
                      Time
                    </th>
                    <th className="text-left py-2.5 px-4 text-xs text-gray-500 font-medium">
                      Details
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {isLoading
                    ? Array.from({ length: pagination.pageSize }, (_, i) => (
                        <AuditLogRowSkeleton key={i} />
                      ))
                    : displayData.map((log) => (
                        <AuditLogRow
                          key={log.id}
                          log={{
                            ...log,
                            action: log.action as AuditActions,
                            actionDescription: getActionDescription(log.action),
                            actionCategory: getActionCategory(log.action),
                            actionBadgeColor: getActionBadgeColor(log.action),
                            actionIcon: getActionIcon(
                              getActionCategory(log.action)
                            ),
                            resourceIcon: getResourceIcon(
                              getResourceTypeFromAction(log.action)
                            ),
                          }}
                        />
                      ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {pagination.totalPages > 1 && (
              <div className="mt-4 pt-4 border-t border-gray-800 flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <span className="text-xs text-gray-500">Show</span>
                  <Select
                    value={pagination.pageSize.toString()}
                    onValueChange={onPageSizeChange}
                  >
                    <SelectTrigger className="w-16 bg-gray-800 border-gray-700 text-gray-300 h-7 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-gray-900 border-gray-800">
                      {PAGE_SIZE_OPTIONS.map((size) => (
                        <SelectItem
                          key={size}
                          value={size.toString()}
                          className="text-gray-300 focus:bg-gray-800 text-xs"
                        >
                          {size}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <span className="text-xs text-gray-500">per page</span>
                </div>

                <div className="flex items-center space-x-1">
                  <Button
                    onClick={() => onPageChange(1)}
                    disabled={!paginationInfo.hasPrevPage}
                    variant="outline"
                    size="sm"
                    className="text-gray-400 border-gray-700 hover:bg-gray-800 h-7 w-7 p-0"
                  >
                    <ChevronsLeft className="w-3.5 h-3.5" />
                  </Button>
                  <Button
                    onClick={() => onPageChange(pagination.page - 1)}
                    disabled={!paginationInfo.hasPrevPage}
                    variant="outline"
                    size="sm"
                    className="text-gray-400 border-gray-700 hover:bg-gray-800 h-7 w-7 p-0"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                  </Button>

                  {paginationInfo.pageNumbers.map((pageNum, index) => (
                    <div key={index}>
                      {pageNum === "..." ? (
                        <span className="px-2 text-xs text-gray-500">...</span>
                      ) : (
                        <Button
                          onClick={() => onPageChange(pageNum as number)}
                          variant={
                            pageNum === pagination.page ? "default" : "outline"
                          }
                          size="sm"
                          className={
                            pageNum === pagination.page
                              ? "bg-violet-500 text-white h-7 w-7 p-0 text-xs"
                              : "text-gray-400 border-gray-700 hover:bg-gray-800 h-7 w-7 p-0 text-xs"
                          }
                        >
                          {pageNum}
                        </Button>
                      )}
                    </div>
                  ))}

                  <Button
                    onClick={() => onPageChange(pagination.page + 1)}
                    disabled={!paginationInfo.hasNextPage}
                    variant="outline"
                    size="sm"
                    className="text-gray-400 border-gray-700 hover:bg-gray-800 h-7 w-7 p-0"
                  >
                    <ChevronRight className="w-3.5 h-3.5" />
                  </Button>
                  <Button
                    onClick={() => onPageChange(pagination.totalPages)}
                    disabled={!paginationInfo.hasNextPage}
                    variant="outline"
                    size="sm"
                    className="text-gray-400 border-gray-700 hover:bg-gray-800 h-7 w-7 p-0"
                  >
                    <ChevronsRight className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
