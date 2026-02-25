import { useMemo } from "react";
import { api } from "@/api";
import { Role } from "@/api/roles.api";
import { UserResponse } from "@envsync-cloud/envsync-ts-sdk";

export type RoleData = Role & {
  users: UserResponse[];
};

export const useRolesTable = () => {
  const { data: rolesData, isLoading: rolesLoading } = api.roles.getAllRoles();
  const { data: usersData, isLoading: usersLoading } = api.users.getAllUsers();

  const isLoading = rolesLoading || usersLoading;

  const data = useMemo(() => {
    if (!rolesData || !usersData) return [];
    return rolesData.map((role) => ({
      ...role,
      users: usersData.filter((user) => user.role_id === role.id),
    }));
  }, [rolesData, usersData]);

  return { data, isLoading };
};
