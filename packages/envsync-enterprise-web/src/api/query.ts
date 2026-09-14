import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { enterpriseErrorMessage, isEnterpriseUiEnabled } from "./client";

export function useEnterpriseQuery<T>(
  queryKey: readonly unknown[],
  queryFn: () => Promise<T>,
  enabled = true,
) {
  return useQuery({
    queryKey,
    queryFn: async () => {
      try {
        return await queryFn();
      } catch (error) {
        throw new Error(enterpriseErrorMessage(error));
      }
    },
    enabled: isEnterpriseUiEnabled() && enabled,
  });
}

export function useEnterpriseMutation<TVariables, TData>(
  mutationFn: (variables: TVariables) => Promise<TData>,
  invalidate: readonly unknown[] | ((variables: TVariables) => readonly unknown[]),
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (variables: TVariables) => {
      try {
        return await mutationFn(variables);
      } catch (error) {
        throw new Error(enterpriseErrorMessage(error));
      }
    },
    onSuccess: async (_data, variables) => {
      const queryKey = typeof invalidate === "function" ? invalidate(variables) : invalidate;
      await queryClient.invalidateQueries({ queryKey: [...queryKey] });
    },
  });
}
