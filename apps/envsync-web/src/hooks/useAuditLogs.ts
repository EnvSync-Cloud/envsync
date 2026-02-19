import { useState, useCallback, useMemo, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { AuditActions } from "@/lib/audit.type";
import { AuditLog } from "@/components/audit/row";
import z from "zod";

export const ActionCategories = z.enum([
  "app*",
  "audit_log*",
  "env*",
  "env_store*",
  "secret_store*",
  "onboarding*",
  "org*",
  "role*",
  "user*",
  "api_key*",
  "webhook*",
  "cli*",
]);

export type ActionCtgs = z.infer<typeof ActionCategories>;

export const ActionPastTimeOptions = z.enum([
  "last_3_hours",
  "last_24_hours",
  "last_7_days",
  "last_30_days",
  "last_90_days",
  "last_180_days",
  "last_1_year",
  "all_time",
]);

export type ActionPastTimes = z.infer<typeof ActionPastTimeOptions>;

interface PaginationInfo {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

interface FilterOptions {
  action: string;
  user: string;
  timeRange: string;
  resourceType: string;
}

const DEFAULT_PAGE_SIZE = 20;
export const PAGE_SIZE_OPTIONS = [10, 20, 50, 100] as const;
const DEBOUNCE_DELAY = 300;

const DEFAULT_FILTER_OPTIONS: FilterOptions = {
  action: "all",
  user: "all",
  timeRange: "all_time",
  resourceType: "all",
};

export const TIME_RANGE_OPTIONS = [
  { value: "last_3_hours", label: "Last 3 Hours" },
  { value: "last_24_hours", label: "Last 24 Hours" },
  { value: "last_7_days", label: "Last 7 Days" },
  { value: "last_30_days", label: "Last 30 Days" },
  { value: "last_90_days", label: "Last 90 Days" },
  { value: "last_180_days", label: "Last 180 Days" },
  { value: "last_1_year", label: "Last 1 Year" },
  { value: "all_time", label: "All Time" },
] as const;

export const RESOURCE_TYPE_OPTIONS: {
  value: z.infer<typeof ActionCategories> | "all";
  label: string;
}[] = [
  { value: "all", label: "All Resources" },
  { value: "app*", label: "Applications" },
  { value: "env*", label: "Variables" },
  { value: "user*", label: "Users" },
  { value: "org*", label: "Organizations" },
  { value: "api_key*", label: "API Keys" },
  { value: "cli*", label: "CLI Commands" },
  { value: "audit_log*", label: "Audit Logs" },
  { value: "env_store*", label: "Environment Store" },
  { value: "secret_store*", label: "Secret Store" },
  { value: "webhook*", label: "Webhooks" },
  { value: "role*", label: "Roles" },
  { value: "onboarding*", label: "Onboarding" },
];

const ACTION_CATEGORIES = {
  create: [
    "app_created",
    "env_created",
    "envs_batch_created",
    "org_created",
    "user_invite_created",
  ],
  update: [
    "app_updated",
    "env_updated",
    "envs_batch_updated",
    "org_updated",
    "user_updated",
    "user_role_updated",
    "user_invite_updated",
  ],
  delete: ["app_deleted", "env_deleted", "user_deleted", "user_invite_deleted"],
  view: [
    "app_viewed",
    "apps_viewed",
    "env_type_viewed",
    "env_types_viewed",
    "env_viewed",
    "envs_viewed",
    "user_invite_viewed",
    "users_retrieved",
    "user_retrieved",
    "get_audit_logs",
  ],
  auth: ["user_invite_accepted", "password_update_requested"],
  cli: ["cli_command_executed"],
} as const;

export function getActionDescription(action: AuditActions): string {
  const descriptions: Record<string, string> = {
    app_created: "Created application",
    app_updated: "Updated application",
    app_deleted: "Deleted application",
    app_viewed: "Viewed application",
    apps_viewed: "Viewed applications list",
    env_types_viewed: "Viewed environment types",
    env_type_viewed: "Viewed environment type",
    env_created: "Created variable",
    env_updated: "Updated variable",
    env_deleted: "Deleted variable",
    env_viewed: "Viewed variable",
    envs_viewed: "Viewed variables",
    envs_batch_created: "Created multiple variables",
    envs_batch_updated: "Updated multiple variables",
    envs_batch_deleted: "Deleted multiple variables",
    envs_rollback_pit: "Rolled back variables to PIT",
    env_variable_rollback_pit: "Rolled back variable to PIT",
    envs_rollback_timestamp: "Rolled back variables to timestamp",
    env_variable_rollback_timestamp: "Rolled back variable to timestamp",
    env_variable_diff_viewed: "Viewed variable diff",
    env_variable_timeline_viewed: "Viewed variable timeline",
    env_variable_history_viewed: "Viewed variable history",
    envs_pit_viewed: "Viewed variables PIT",
    envs_timestamp_viewed: "Viewed variables timestamp",
    env_type_created: "Created environment type",
    env_type_updated: "Updated environment type",
    env_type_deleted: "Deleted environment type",
    users_retrieved: "Retrieved users list",
    user_retrieved: "Retrieved user details",
    user_updated: "Updated user profile",
    user_deleted: "Deleted user account",
    user_role_updated: "Updated user role",
    password_update_requested: "Requested password update",
    org_created: "Created organization",
    org_updated: "Updated organization",
    user_invite_created: "Created user invitation",
    user_invite_accepted: "Accepted user invitation",
    user_invite_viewed: "Viewed user invitation",
    user_invite_updated: "Updated user invitation",
    user_invite_deleted: "Deleted user invitation",
    user_invites_retrieved: "Retrieved user invitations list",
    get_audit_logs: "Viewed audit logs",
    cli_command_executed: "Executed CLI command",
    apikey_created: "Created API key",
    apikey_deleted: "Deleted API key",
    apikey_viewed: "Viewed API key",
    apikeys_viewed: "Viewed API keys list",
    apikey_regenerated: "Regenerated API key",
    apikey_updated: "Updated API key",
    webhook_created: "Created webhook",
    webhook_updated: "Updated webhook",
    webhook_deleted: "Deleted webhook",
    webhook_triggered: "Triggered webhook",
    webhook_viewed: "Viewed webhook",
    webhooks_viewed: "Viewed webhooks list",
    secret_created: "Created secret",
    secret_deleted: "Deleted secret",
    secret_updated: "Updated secret",
    secret_viewed: "Viewed secret",
    secrets_viewed: "Viewed secrets list",
    secrets_batch_created: "Created multiple secrets",
    secrets_batch_updated: "Updated multiple secrets",
    secrets_batch_deleted: "Deleted multiple secrets",
    secrets_rollback_pit: "Rolled back secrets to PIT",
    secrets_rollback_timestamp: "Rolled back secrets to timestamp",
    secret_variable_rollback_pit: "Rolled back secret variable to PIT",
    secret_variable_rollback_timestamp: "Rolled back secret variable to timestamp",
    secret_history_viewed: "Viewed secret history",
    secret_variable_history_viewed: "Viewed secret variable history",
    secret_diff_viewed: "Viewed secret diff",
    secret_timeline_viewed: "Viewed secret timeline",
    secrets_pit_viewed: "Viewed secrets PIT",
    secrets_timestamp_viewed: "Viewed secrets timestamp",
    roles_viewed: "Viewed roles",
    role_viewed: "Viewed role",
    role_created: "Created role",
    role_updated: "Updated role",
    role_deleted: "Deleted role",
  };
  return (
    descriptions[action] ||
    action.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase())
  );
}

export function getActionCategory(
  action: AuditActions
): keyof typeof ACTION_CATEGORIES {
  for (const [category, actions] of Object.entries(ACTION_CATEGORIES)) {
    if (actions.includes(action as never)) {
      return category as keyof typeof ACTION_CATEGORIES;
    }
  }
  return "view";
}

export function getResourceTypeFromAction(action: AuditActions): string {
  for (const [category, actions] of Object.entries(ACTION_CATEGORIES)) {
    if (actions.includes(action as never)) {
      return category;
    }
  }
  return "view";
}

export function getActionBadgeColor(action: AuditActions): string {
  const category = getActionCategory(action);
  switch (category) {
    case "create":
      return "bg-green-500/10 text-green-400 border-green-500/20";
    case "update":
      return "bg-violet-500/10 text-violet-400 border-violet-500/20";
    case "delete":
      return "bg-red-500/10 text-red-400 border-red-500/20";
    case "view":
      return "bg-gray-500/10 text-gray-400 border-gray-500/20";
    case "auth":
      return "bg-blue-500/10 text-blue-400 border-blue-500/20";
    case "cli":
      return "bg-amber-500/10 text-amber-400 border-amber-500/20";
    default:
      return "bg-gray-500/10 text-gray-400 border-gray-500/20";
  }
}

export function useAuditLogs() {
  const { api } = useAuth();

  const generatePageNumbers = useCallback(
    (currentPage: number, totalPages: number) => {
      const delta = 2;
      const range = [];
      const rangeWithDots: (number | string)[] = [];

      for (
        let i = Math.max(2, currentPage - delta);
        i <= Math.min(totalPages - 1, currentPage + delta);
        i++
      ) {
        range.push(i);
      }

      if (currentPage - delta > 2) {
        rangeWithDots.push(1, "...");
      } else {
        rangeWithDots.push(1);
      }

      rangeWithDots.push(...range);

      if (currentPage + delta < totalPages - 1) {
        rangeWithDots.push("...", totalPages);
      } else if (totalPages > 1) {
        rangeWithDots.push(totalPages);
      }

      return rangeWithDots;
    },
    []
  );

  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState("");
  const [filterOptions, setFilterOptions] =
    useState<FilterOptions>(DEFAULT_FILTER_OPTIONS);
  const [pagination, setPagination] = useState<PaginationInfo>({
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
        api.auditLogs.getAuditLogs(
          pagination.page.toString(),
          pagination.pageSize.toString(),
          customFilters.filterByUser || undefined,
          customFilters.filterByCategory || undefined,
          customFilters.filterByPastTime || undefined
        ),
        api.users.getUsers(),
      ]);

      const usersMap = new Map(usersResponse.map((user) => [user.id, user]));

      const logs: AuditLog[] = auditLogsResponse.auditLogs.map((log) => ({
        id: log.id,
        action: log.action as AuditActions,
        details:
          log.details || getActionDescription(log.action as AuditActions),
        user_name: usersMap.get(log.user_id)?.full_name || "Unknown User",
        user_id: log.user_id,
        profile_picture:
          usersMap.get(log.user_id)?.profile_picture_url || "",
        timestamp: new Date(log.created_at).toLocaleString(),
        created_at: log.created_at,
        project: JSON.parse(log.details).project_id,
        environment: JSON.parse(log.details).env_type_id,
        resource_type: getResourceTypeFromAction(log.action as AuditActions),
        resource_id: "",
        ip_address: "",
        user_agent: "",
      }));

      const totalCount = auditLogsResponse.totalPages;
      const totalPages = Math.ceil(totalCount / pagination.pageSize);

      setPagination((prev) => ({
        ...prev,
        total: totalCount,
        totalPages,
      }));

      return { logs, users: usersResponse, pagination: { totalCount, totalPages } };
    },
    staleTime: 30 * 1000,
    retry: 3,
  });

  const handleFilterChange = useCallback(
    (key: keyof FilterOptions, value: string) => {
      setFilterOptions((prev) => ({ ...prev, [key]: value }));
      if (key === "user") {
        setCustomFilters((prev) => ({
          ...prev,
          filterByUser: value === "all" ? "" : value,
        }));
      }
      if (key === "resourceType") {
        setCustomFilters((prev) => ({
          ...prev,
          filterByCategory:
            value === "all" ? null : (value as ActionCtgs),
        }));
      }
      if (key === "timeRange") {
        setCustomFilters((prev) => ({
          ...prev,
          filterByPastTime:
            value === "all_time" ? null : (value as ActionPastTimes),
        }));
      }
    },
    []
  );

  const handlePageChange = useCallback((newPage: number) => {
    setPagination((prev) => ({ ...prev, page: newPage }));
  }, []);

  const handlePageSizeChange = useCallback((newPageSize: string) => {
    const pageSize = parseInt(newPageSize, 10);
    setPagination((prev) => ({
      ...prev,
      pageSize,
      page: 1,
      totalPages: Math.ceil(prev.total / pageSize),
    }));
  }, []);

  const handleClearSearch = useCallback(() => {
    setSearchQuery("");
  }, []);

  const handleResetFilters = useCallback(() => {
    setFilterOptions(DEFAULT_FILTER_OPTIONS);
    setSearchQuery("");
    setPagination((prev) => ({ ...prev, page: 1 }));
  }, []);

  const handleExportLogs = useCallback(async () => {
    toast.info("Preparing audit logs export...");
    toast.success("Audit logs exported successfully");
  }, []);

  const displayData = useMemo(() => auditLogsData?.logs || [], [auditLogsData]);

  const paginationInfo = useMemo(() => {
    const startItem = (pagination.page - 1) * pagination.pageSize + 1;
    const endItem = Math.min(
      pagination.page * pagination.pageSize,
      pagination.total
    );
    return {
      startItem,
      endItem,
      hasNextPage: pagination.page < pagination.totalPages,
      hasPrevPage: pagination.page > 1,
      pageNumbers: generatePageNumbers(pagination.page, pagination.totalPages),
    };
  }, [pagination, generatePageNumbers]);

  const isEmpty = useMemo(
    () => !isLoading && displayData.length === 0 && !error,
    [isLoading, displayData.length, error]
  );

  return {
    searchQuery,
    setSearchQuery,
    debouncedSearchQuery,
    filterOptions,
    pagination,
    auditLogsData,
    isLoading,
    error,
    refetch,
    isRefetching,
    displayData,
    paginationInfo,
    isEmpty,
    handleFilterChange,
    handlePageChange,
    handlePageSizeChange,
    handleClearSearch,
    handleResetFilters,
    handleExportLogs,
  };
}
