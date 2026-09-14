import { useMutation, useQuery } from "@tanstack/react-query";

import { API_KEYS } from "@/constants";
import { useInvalidateQueries } from "@/hooks/useApi";

import { apiRequest, type MutationOptions } from "./base";

export interface ChangeRequestItem {
  id: string;
  change_request_id: string;
  key: string;
  previous_value: string | null;
  proposed_value: string | null;
  operation: "CREATE" | "UPDATE" | "DELETE";
  created_at: string;
  updated_at: string;
}

export interface ChangeRequest {
  id: string;
  org_id: string;
  app_id: string;
  request_kind: "direct" | "promotion";
  source_env_type_id: string | null;
  target_env_type_id: string;
  status: "pending" | "approved" | "rejected" | "cancelled";
  title: string;
  message: string;
  requested_by_user_id: string;
  reviewed_by_user_id: string | null;
  reviewed_at: string | null;
  applied_at: string | null;
  rejection_reason: string | null;
  created_at: string;
  updated_at: string;
  env_item_count: number;
  secret_item_count: number;
  env_items: ChangeRequestItem[];
  secret_items: ChangeRequestItem[];
}

export interface DirectChangeRequestPayload {
  app_id: string;
  target_env_type_id: string;
  title: string;
  message: string;
  envs?: Array<{ key: string; operation: "CREATE" | "UPDATE" | "DELETE"; proposed_value?: string | null }>;
  secrets?: Array<{ key: string; operation: "CREATE" | "UPDATE" | "DELETE"; proposed_value?: string | null }>;
}

export interface PromotionChangeRequestPayload {
  app_id: string;
  source_env_type_id: string;
  target_env_type_id: string;
  title: string;
  message: string;
}

const useChangeRequests = (
  filters: { status?: string; appId?: string } = {},
  { enabled = true }: { enabled?: boolean } = {},
) =>
  useQuery({
    queryKey: [API_KEYS.CHANGE_REQUESTS, filters.status || "all", filters.appId || "all"],
    queryFn: () => {
      const params = new URLSearchParams();
      if (filters.status) params.set("status", filters.status);
      if (filters.appId) params.set("app_id", filters.appId);
      const query = params.toString();
      return apiRequest<ChangeRequest[]>(`/api/change_request${query ? `?${query}` : ""}`);
    },
    enabled,
  });

const useChangeRequest = (id?: string, { enabled = true }: { enabled?: boolean } = {}) =>
  useQuery({
    queryKey: [API_KEYS.CHANGE_REQUESTS, id],
    queryFn: () => apiRequest<ChangeRequest>(`/api/change_request/${id}`),
    enabled: enabled && Boolean(id),
  });

const useCreateDirectChangeRequest = ({
  onSuccess,
  onError,
}: MutationOptions<ChangeRequest, DirectChangeRequestPayload> = {}) => {
  const { invalidateChangeRequests, invalidateProjectData } = useInvalidateQueries();

  return useMutation({
    mutationFn: (payload: DirectChangeRequestPayload) =>
      apiRequest<ChangeRequest>("/api/change_request/direct", {
        method: "POST",
        body: JSON.stringify(payload),
      }),
    onSuccess: async (data, variables) => {
      await Promise.all([invalidateChangeRequests(), invalidateProjectData(variables.app_id)]);
      onSuccess?.({ data, variables });
    },
    onError: (error, variables) => onError?.({ error: error as Error, variables }),
  });
};

const useCreatePromotionChangeRequest = ({
  onSuccess,
  onError,
}: MutationOptions<ChangeRequest, PromotionChangeRequestPayload> = {}) => {
  const { invalidateChangeRequests, invalidateProjectData } = useInvalidateQueries();

  return useMutation({
    mutationFn: (payload: PromotionChangeRequestPayload) =>
      apiRequest<ChangeRequest>("/api/change_request/promotion", {
        method: "POST",
        body: JSON.stringify(payload),
      }),
    onSuccess: async (data, variables) => {
      await Promise.all([invalidateChangeRequests(), invalidateProjectData(variables.app_id)]);
      onSuccess?.({ data, variables });
    },
    onError: (error, variables) => onError?.({ error: error as Error, variables }),
  });
};

const useApproveChangeRequest = ({
  onSuccess,
  onError,
}: MutationOptions<ChangeRequest, { id: string; app_id?: string }> = {}) => {
  const { invalidateChangeRequests, invalidateProjectData } = useInvalidateQueries();

  return useMutation({
    mutationFn: ({ id }: { id: string; app_id?: string }) =>
      apiRequest<ChangeRequest>(`/api/change_request/${id}/approve`, { method: "POST" }),
    onSuccess: async (data, variables) => {
      await Promise.all([
        invalidateChangeRequests(),
        variables.app_id ? invalidateProjectData(variables.app_id) : Promise.resolve(),
      ]);
      onSuccess?.({ data, variables });
    },
    onError: (error, variables) => onError?.({ error: error as Error, variables }),
  });
};

const useRejectChangeRequest = ({
  onSuccess,
  onError,
}: MutationOptions<ChangeRequest, { id: string; rejection_reason: string; app_id?: string }> = {}) => {
  const { invalidateChangeRequests } = useInvalidateQueries();

  return useMutation({
    mutationFn: ({ id, rejection_reason }: { id: string; rejection_reason: string; app_id?: string }) =>
      apiRequest<ChangeRequest>(`/api/change_request/${id}/reject`, {
        method: "POST",
        body: JSON.stringify({ rejection_reason }),
      }),
    onSuccess: async (data, variables) => {
      await invalidateChangeRequests();
      onSuccess?.({ data, variables });
    },
    onError: (error, variables) => onError?.({ error: error as Error, variables }),
  });
};

const useCancelChangeRequest = ({
  onSuccess,
  onError,
}: MutationOptions<ChangeRequest, { id: string; app_id?: string }> = {}) => {
  const { invalidateChangeRequests } = useInvalidateQueries();

  return useMutation({
    mutationFn: ({ id }: { id: string; app_id?: string }) =>
      apiRequest<ChangeRequest>(`/api/change_request/${id}/cancel`, { method: "POST" }),
    onSuccess: async (data, variables) => {
      await invalidateChangeRequests();
      onSuccess?.({ data, variables });
    },
    onError: (error, variables) => onError?.({ error: error as Error, variables }),
  });
};

export const changeRequests = {
  getChangeRequests: useChangeRequests,
  getChangeRequest: useChangeRequest,
  createDirect: useCreateDirectChangeRequest,
  createPromotion: useCreatePromotionChangeRequest,
  approve: useApproveChangeRequest,
  reject: useRejectChangeRequest,
  cancel: useCancelChangeRequest,
};
