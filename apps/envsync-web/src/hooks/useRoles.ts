import { api } from "@/api";
import { Role } from "@/api/roles.api";
import { API_KEYS } from "@/constants";
import { UserResponse } from "@envsync-cloud/envsync-ts-sdk";
import { useQuery } from "@tanstack/react-query";

export type RoleData = Role & {
  users: UserResponse[];
};

export const useRolesTable = () => {
  const roles = api.roles.getAllRoles();
  const users = api.users.getAllUsers();

  return useQuery({
    queryKey: [API_KEYS.ALL_ROLES, "table"],
    queryFn: async () => {
      const rolesData = roles.data;
      const usersData = users.data;

      return rolesData.map((role) => ({
        ...role,
        users: usersData.filter((user) => user.role_id === role.id),
      }));
    },
    retry: 3,
    refetchInterval: 1 * 60 * 1000,
  });
};
