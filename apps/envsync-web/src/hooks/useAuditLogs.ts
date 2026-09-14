import { useState, useCallback, useMemo, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { sdk } from "@/api";
import { fetchAuditLogPage } from "@/api/audit-logs.api";
import { useAuthContext } from "@/contexts/auth";
import { toast } from "sonner";
import { AuditActions } from "@/lib/audit.type";
import { AuditLog } from "@/components/audit/row";
import {
  ActionCtgs,
  ActionPastTimes,
  getActionDescription,
  getResourceTypeFromAction,
} from "@/lib/audit-catalog";
import { buildAuditExportCsv } from "@/lib/audit-export";

export { csvEscape, buildAuditExportCsv } from "@/lib/audit-export";
export {
  ActionCategories,
  ActionPastTimeOptions,
  getActionBadgeColor,
  getActionCategory,
  getActionDescription,
  getResourceTypeFromAction,
  PAGE_SIZE_OPTIONS,
  RESOURCE_TYPE_OPTIONS,
  TIME_RANGE_OPTIONS,
} from "@/lib/audit-catalog";
export type { ActionCtgs, ActionPastTimes } from "@/lib/audit-catalog";

const EXPORT_PAGE_CAP = 10_000;
const DEFAULT_PAGE_SIZE = 20;
const DEBOUNCE_DELAY = 300;

const DEFAULT_FILTER_OPTIONS = {
  action: "all",
  user: "all",
  timeRange: "all_time",
  resourceType: "all",
};

export function useAuditLogs() {
  const { isLoading: isAuthLoading, isAuthenticated } = useAuthContext();
  const authEnabled = !isAuthLoading && isAuthenticated;

  const generatePageNumbers = useCallback((currentPage: number, totalPages: number) => {
    const delta = 2;
    const range = [];
    const rangeWithDots: (number | string)[] = [];

    for (let i = Math.max(2, currentPage - delta); i <= Math.min(totalPages - 1, currentPage + delta); i++) {
      range.push(i);
    }
    if (currentPage - delta > 2) rangeWithDots.push(1, "...");
    else rangeWithDots.push(1);
    rangeWithDots.push(...range);
    if (currentPage + delta < totalPages - 1) rangeWithDots.push("...", totalPages);
    else if (totalPages > 1) rangeWithDots.push(totalPages);
    return rangeWithDots;
  }, []);

  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState("");
  const [filterOptions, setFilterOptions] = useState(DEFAULT_FILTER_OPTIONS);
  const [pagination, setPagination] = useState({
    page: 1,
    pageSize: DEFAULT_PAGE_SIZE,
    total: 0,
    totalPages: 0,
  });
  const [customFilters, setCustomFilters] = useState<{
    filterByUser: string;
    filterByCategory: ActionCtgs | undefined | null;
    filterByPastTime: ActionPastTimes | undefined | null;
  }>({
    filterByUser: "",
    filterByCategory: null,
    filterByPastTime: null,
  });

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery);
      if (searchQuery !== debouncedSearchQuery) {
        setPagination((prev) => ({ ...prev, page: 1 }));
      }
    }, DEBOUNCE_DELAY);
    return () => clearTimeout(timer);
  }, [searchQuery, debouncedSearchQuery]);

  useEffect(() => {
    setPagination((prev) => ({ ...prev, page: 1 }));
  }, [filterOptions, debouncedSearchQuery]);

  const {
    data: auditLogsData,
    isLoading,
    error,
    refetch,
    isRefetching,
  } = useQuery({
    queryKey: [
      "audit-logs",
      pagination.page,
      pagination.pageSize,
      customFilters,
      debouncedSearchQuery,
      filterOptions,
    ],
    queryFn: async () => {
      const [auditLogsResponse, usersResponse] = await Promise.all([
        fetchAuditLogPage({
          page: pagination.page,
          pageSize: pagination.pageSize,
          filterByUser: customFilters.filterByUser || undefined,
          filterByCategory: customFilters.filterByCategory || undefined,
          filterByPastTime: customFilters.filterByPastTime || undefined,
          q: debouncedSearchQuery.trim() || undefined,
        }),
        sdk.users.getUsers(),
      ]);

      const usersMap = new Map(usersResponse.map((user) => [user.id, user]));
      const logs: AuditLog[] = auditLogsResponse.auditLogs.map((log) => ({
        id: log.id,
        action: log.action as AuditActions,
        details: log.details || getActionDescription(log.action as AuditActions),
        user_name: usersMap.get(log.user_id)?.full_name || "Unknown User",
        user_id: log.user_id,
        profile_picture: usersMap.get(log.user_id)?.profile_picture_url || "",
        timestamp: new Date(log.created_at).toLocaleString(),
        created_at: log.created_at,
        project: safeJsonField(log.details, "project_id"),
        environment: safeJsonField(log.details, "env_type_id"),
        resource_type: getResourceTypeFromAction(log.action as AuditActions),
        resource_id: "",
        ip_address: "",
        user_agent: "",
      }));

      const totalPages = Math.max(0, auditLogsResponse.totalPages || 0);
      return { logs, users: usersResponse, totalPages };
    },
    enabled: authEnabled,
    staleTime: 30 * 1000,
    retry: 3,
  });

  const totalPages = auditLogsData?.totalPages ?? 0;
  const pageState = { ...pagination, totalPages, total: totalPages };

  const handleFilterChange = useCallback((key: keyof typeof DEFAULT_FILTER_OPTIONS, value: string) => {
    setFilterOptions((prev) => ({ ...prev, [key]: value }));
    if (key === "user") {
      setCustomFilters((prev) => ({ ...prev, filterByUser: value === "all" ? "" : value }));
    }
    if (key === "resourceType") {
      setCustomFilters((prev) => ({
        ...prev,
        filterByCategory: value === "all" ? null : (value as ActionCtgs),
      }));
    }
    if (key === "timeRange") {
      setCustomFilters((prev) => ({
        ...prev,
        filterByPastTime: value === "all_time" ? null : (value as ActionPastTimes),
      }));
    }
  }, []);

  const handlePageChange = useCallback((newPage: number) => {
    setPagination((prev) => ({ ...prev, page: newPage }));
  }, []);

  const handlePageSizeChange = useCallback((newPageSize: string) => {
    setPagination((prev) => ({ ...prev, pageSize: parseInt(newPageSize, 10), page: 1 }));
  }, []);

  const handleClearSearch = useCallback(() => setSearchQuery(""), []);

  const handleResetFilters = useCallback(() => {
    setFilterOptions(DEFAULT_FILTER_OPTIONS);
    setSearchQuery("");
    setPagination((prev) => ({ ...prev, page: 1 }));
  }, []);

  const handleExportLogs = useCallback(async () => {
    toast.info("Preparing audit logs export...");
    try {
      const users = await sdk.users.getUsers();
      const usersMap = new Map(users.map((user) => [user.id, user]));
      const rows: Array<{ created_at: string; action: string; user_name: string; details: string }> = [];
      let page = 1;
      let pages = 1;
      while (page <= pages && rows.length < EXPORT_PAGE_CAP) {
        const response = await fetchAuditLogPage({
          page,
          pageSize: 100,
          filterByUser: customFilters.filterByUser || undefined,
          filterByCategory: customFilters.filterByCategory || undefined,
          filterByPastTime: customFilters.filterByPastTime || undefined,
          q: debouncedSearchQuery.trim() || undefined,
        });
        pages = Math.max(1, response.totalPages || 1);
        for (const log of response.auditLogs) {
          rows.push({
            created_at: log.created_at,
            action: log.action,
            user_name: usersMap.get(log.user_id)?.full_name || "Unknown User",
            details: log.details || getActionDescription(log.action as AuditActions),
          });
          if (rows.length >= EXPORT_PAGE_CAP) break;
        }
        page += 1;
      }

      const csv = buildAuditExportCsv(rows);
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "audit-logs.csv";
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      toast.success("Audit logs exported successfully");
    } catch (error) {
      console.error("Failed to export audit logs:", error);
      toast.error("Failed to export audit logs");
    }
  }, [customFilters, debouncedSearchQuery]);

  const displayData = useMemo(() => auditLogsData?.logs || [], [auditLogsData]);
  const paginationInfo = useMemo(() => {
    const startItem = (pageState.page - 1) * pageState.pageSize + 1;
    const endItem = pageState.page * pageState.pageSize;
    return {
      startItem,
      endItem,
      hasNextPage: pageState.page < totalPages,
      hasPrevPage: pageState.page > 1,
      pageNumbers: generatePageNumbers(pageState.page, totalPages),
    };
  }, [pageState.page, pageState.pageSize, totalPages, generatePageNumbers]);

  return {
    searchQuery,
    setSearchQuery,
    debouncedSearchQuery,
    filterOptions,
    pagination: pageState,
    auditLogsData,
    isLoading,
    error,
    refetch,
    isRefetching,
    displayData,
    paginationInfo,
    isEmpty: !isLoading && displayData.length === 0 && !error,
    handleFilterChange,
    handlePageChange,
    handlePageSizeChange,
    handleClearSearch,
    handleResetFilters,
    handleExportLogs,
  };
}

function safeJsonField(details: string, field: string) {
  try {
    const parsed = JSON.parse(details) as Record<string, unknown>;
    return typeof parsed[field] === "string" ? parsed[field] : "";
  } catch {
    return "";
  }
}
