import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { sdk } from "./base";
import { toast } from "sonner";
import type { 
    EnvHistoryRequest, 
    EnvHistoryResponse, 
    EnvPitRequest, 
    EnvPitStateResponse, 
    EnvTimestampRequest, 
    EnvDiffRequest, 
    EnvDiffResponse, 
    VariableTimelineRequest, 
    VariableTimelineResponse, 
    RollbackToPitRequest, 
    RollbackToTimestampRequest, 
    RollbackResponse 
} from "@envsync-cloud/envsync-ts-sdk";

// Point-in-Time History Hook
export const usePointInTimeHistory = (
    params: EnvHistoryRequest,
    options?: {
        enabled?: boolean;
        staleTime?: number;
    }
) => {
    return useQuery({
        queryKey: ["pit-history", params.app_id, params.env_type_id, params.page, params.per_page],
        queryFn: async (): Promise<EnvHistoryResponse> => {
            return await sdk.environmentVariablesPointInTime.getEnvHistory(params);
        },
        enabled: options?.enabled ?? true,
        staleTime: options?.staleTime ?? 30000, // 30 seconds
        retry: 3,
    });
};

// Point-in-Time State Hook (get variables at specific PIT)
export const useEnvsAtPit = (
    params: EnvPitRequest,
    options?: {
        enabled?: boolean;
        staleTime?: number;
    }
) => {
    return useQuery({
        queryKey: ["pit-state", params.app_id, params.env_type_id, params.pit_id],
        queryFn: async (): Promise<EnvPitStateResponse> => {
            return await sdk.environmentVariablesPointInTime.getEnvsAtPointInTime(params);
        },
        enabled: options?.enabled ?? true,
        staleTime: options?.staleTime ?? 60000, // 1 minute
        retry: 2,
    });
};

// Point-in-Time State at Timestamp Hook
export const useEnvsAtTimestamp = (
    params: EnvTimestampRequest,
    options?: {
        enabled?: boolean;
        staleTime?: number;
    }
) => {
    return useQuery({
        queryKey: ["pit-timestamp", params.app_id, params.env_type_id, params.timestamp],
        queryFn: async (): Promise<EnvPitStateResponse> => {
            return await sdk.environmentVariablesPointInTime.getEnvsAtTimestamp(params);
        },
        enabled: options?.enabled ?? true,
        staleTime: options?.staleTime ?? 60000, // 1 minute
        retry: 2,
    });
};

// Point-in-Time Diff Hook (mutation-based for on-demand comparison)
export const usePointInTimeDiff = () => {
    return useMutation({
        mutationFn: async (params: EnvDiffRequest): Promise<EnvDiffResponse> => {
            return await sdk.environmentVariablesPointInTime.getEnvDiff(params);
        },
        onError: (error) => {
            console.error("Failed to get PIT diff:", error);
            toast.error("Failed to compare point-in-time snapshots");
        },
    });
};

// Variable Timeline Hook
export const useVariableTimeline = (
    params: VariableTimelineRequest,
    options?: {
        enabled?: boolean;
        staleTime?: number;
    }
) => {
    return useQuery({
        queryKey: ["variable-timeline", params.app_id, params.env_type_id, params.key],
        queryFn: async (): Promise<VariableTimelineResponse> => {
            return await sdk.environmentVariablesPointInTime.getVariableTimeline(params.key, params);
        },
        enabled: options?.enabled ?? true,
        staleTime: options?.staleTime ?? 60000, // 1 minute
        retry: 2,
    });
};

// Rollback Hooks
export const usePointInTimeRollback = () => {
    const queryClient = useQueryClient();

    const rollbackToPit = useMutation({
        mutationFn: async (params: RollbackToPitRequest): Promise<RollbackResponse> => {
            return await sdk.environmentVariablesRollback.rollbackEnvsToPitId(params);
        },
        onSuccess: (data, variables) => {
            // Invalidate related queries
            queryClient.invalidateQueries({
                queryKey: ["pit-history", variables.app_id, variables.env_type_id],
            });
            queryClient.invalidateQueries({
                queryKey: ["project-environments", variables.app_id],
            });
            queryClient.invalidateQueries({
                queryKey: ["environment-variables", variables.app_id, variables.env_type_id],
            });
            
            toast.success("Successfully rolled back to point-in-time snapshot");
        },
        onError: (error) => {
            console.error("Failed to rollback to PIT:", error);
            toast.error("Failed to rollback to point-in-time snapshot");
        },
    });

    const rollbackToTimestamp = useMutation({
        mutationFn: async (params: RollbackToTimestampRequest): Promise<RollbackResponse> => {
            return await sdk.environmentVariablesRollback.rollbackEnvsToTimestamp(params);
        },
        onSuccess: (data, variables) => {
            // Invalidate related queries
            queryClient.invalidateQueries({
                queryKey: ["pit-history", variables.app_id, variables.env_type_id],
            });
            queryClient.invalidateQueries({
                queryKey: ["project-environments", variables.app_id],
            });
            queryClient.invalidateQueries({
                queryKey: ["environment-variables", variables.app_id, variables.env_type_id],
            });
            
            toast.success("Successfully rolled back to timestamp");
        },
        onError: (error) => {
            console.error("Failed to rollback to timestamp:", error);
            toast.error("Failed to rollback to timestamp");
        },
    });

    return {
        rollbackToPit,
        rollbackToTimestamp,
    };
};

// Variable-specific rollback hooks
export const useVariableRollback = () => {
    const queryClient = useQueryClient();

    const rollbackVariableToPit = useMutation({
        mutationFn: async (params: { key: string } & RollbackToPitRequest) => {
            const { key, ...rollbackParams } = params;
            return await sdk.environmentVariablesRollback.rollbackVariableToPitId(key, rollbackParams);
        },
        onSuccess: (data, variables) => {
            // Invalidate related queries
            queryClient.invalidateQueries({
                queryKey: ["variable-timeline", variables.app_id, variables.env_type_id, variables.key],
            });
            queryClient.invalidateQueries({
                queryKey: ["environment-variables", variables.app_id, variables.env_type_id],
            });
            
            toast.success(`Successfully rolled back variable "${variables.key}"`);
        },
        onError: (error) => {
            console.error("Failed to rollback variable:", error);
            toast.error("Failed to rollback variable");
        },
    });

    const rollbackVariableToTimestamp = useMutation({
        mutationFn: async (params: { key: string } & RollbackToTimestampRequest) => {
            const { key, ...rollbackParams } = params;
            return await sdk.environmentVariablesRollback.rollbackVariableToTimestamp(key, rollbackParams);
        },
        onSuccess: (data, variables) => {
            // Invalidate related queries
            queryClient.invalidateQueries({
                queryKey: ["variable-timeline", variables.app_id, variables.env_type_id, variables.key],
            });
            queryClient.invalidateQueries({
                queryKey: ["environment-variables", variables.app_id, variables.env_type_id],
            });
            
            toast.success(`Successfully rolled back variable "${variables.key}"`);
        },
        onError: (error) => {
            console.error("Failed to rollback variable:", error);
            toast.error("Failed to rollback variable");
        },
    });

    return {
        rollbackVariableToPit,
        rollbackVariableToTimestamp,
    };
};

// Export all hooks for easy importing
export const pointInTimeApi = {
    usePointInTimeHistory,
    useEnvsAtPit,
    useEnvsAtTimestamp,
    usePointInTimeDiff,
    useVariableTimeline,
    usePointInTimeRollback,
    useVariableRollback,
};
