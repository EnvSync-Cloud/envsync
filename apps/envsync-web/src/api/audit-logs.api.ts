import { apiRequest } from "@/api";

export type AuditLogApiRow = {
  id: string;
  action: string;
  details: string;
  message?: string;
  user_id: string;
  created_at: string;
};

export type AuditLogsApiResponse = {
  auditLogs: AuditLogApiRow[];
  totalPages: number;
};

export async function fetchAuditLogPage(params: {
  page: number;
  pageSize: number;
  filterByUser?: string;
  filterByCategory?: string;
  filterByPastTime?: string;
  q?: string;
}): Promise<AuditLogsApiResponse> {
  const search = new URLSearchParams({
    page: String(params.page),
    per_page: String(params.pageSize),
  });
  if (params.filterByUser) search.set("filter_by_user", params.filterByUser);
  if (params.filterByCategory) search.set("filter_by_category", params.filterByCategory);
  if (params.filterByPastTime) search.set("filter_by_past_time", params.filterByPastTime);
  if (params.q) search.set("q", params.q);
  return apiRequest<AuditLogsApiResponse>(`/api/audit_log?${search.toString()}`);
}
