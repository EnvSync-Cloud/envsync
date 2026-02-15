import { useState, useCallback } from "react";
import { useQueryClient, useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";

interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  roleId: string;
  status: string;
  lastSeen: string;
  avatar: string;
}

interface FormErrors {
  email?: string;
  role?: string;
}

export const useUsers = () => {
  const { api } = useAuth();
  const queryClient = useQueryClient();

  // State management
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [selectedUserName, setSelectedUserName] = useState<string>("");
  const [emailAddress, setEmailAddress] = useState("");
  const [selectedRoleId, setSelectedRoleId] = useState<string>("");
  const [formErrors, setFormErrors] = useState<FormErrors>({});
  const [actionLoadingStates, setActionLoadingStates] = useState<
    Record<string, boolean>
  >({});

  // Fetch users and roles data
  const {
    data: { users = [], roles = [] } = {},
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ["usersData"],
    queryFn: async () => {
      const [usersData, rolesData] = await Promise.all([
        api.users.getUsers(),
        api.roles.getAllRoles(),
      ]);

      const processedUsers = usersData.map((user) => ({
        id: user.id,
        name: user.full_name,
        email: user.email,
        role:
          rolesData.find((role) => role.id === user.role_id)?.name || "Viewer",
        roleId: user.role_id,
        status: user.is_active ? "active" : "inactive",
        lastSeen: new Date(user.updated_at).toLocaleDateString("en-US", {
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
          hour: "2-digit",
          minute: "2-digit",
          hour12: true,
        }),
        avatar: user.profile_picture_url,
      }));

      const processedRoles = rolesData.map((role) => ({
        id: role.id,
        name: role.name,
      }));

      return { users: processedUsers, roles: processedRoles };
    },
    staleTime: 5 * 60 * 1000,
    retry: 3,
  });

  // Helper function to set loading state for individual actions
  const setActionLoading = useCallback((userId: string, loading: boolean) => {
    setActionLoadingStates((prev) => ({ ...prev, [userId]: loading }));
  }, []);

  // Form validation
  const validateInviteForm = useCallback((): boolean => {
    const errors: FormErrors = {};

    if (!emailAddress.trim()) {
      errors.email = "Email address is required";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailAddress)) {
      errors.email = "Please enter a valid email address";
    }

    if (!selectedRoleId) {
      errors.role = "Please select a role";
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  }, [emailAddress, selectedRoleId]);

  const validateEditForm = useCallback((): boolean => {
    const errors: FormErrors = {};

    if (!selectedRoleId) {
      errors.role = "Please select a role";
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  }, [selectedRoleId]);

  // Mutations
  const inviteUserMutation = useMutation({
    mutationFn: async ({
      email,
      role_id,
    }: {
      email: string;
      role_id: string;
    }) => {
      return await api.onboarding.createUserInvite({ email, role_id });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["usersData"] });
      resetInviteForm();
      console.log("User invited successfully");
    },
    onError: (error) => {
      console.error("Error inviting user:", error);
    },
  });

  const deleteUserMutation = useMutation({
    mutationFn: async (userId: string) => {
      setActionLoading(userId, true);
      return await api.users.deleteUser(userId);
    },
    onSuccess: (_, userId) => {
      queryClient.invalidateQueries({ queryKey: ["usersData"] });
      setActionLoading(userId, false);
      console.log("User deleted successfully");
    },
    onError: (error, userId) => {
      console.error("Error deleting user:", error);
      setActionLoading(userId, false);
    },
  });

  const editUserRoleMutation = useMutation({
    mutationFn: async ({
      userId,
      roleId,
    }: {
      userId: string;
      roleId: string;
    }) => {
      setActionLoading(userId, true);
      return await api.users.updateRole(userId, { role_id: roleId });
    },
    onSuccess: (_, { userId }) => {
      queryClient.invalidateQueries({ queryKey: ["usersData"] });
      setActionLoading(userId, false);
      console.log("User role updated successfully");
    },
    onError: (error, { userId }) => {
      console.error("Error editing user role:", error);
      setActionLoading(userId, false);
    },
  });

  // Helper functions
  const resetInviteForm = useCallback(() => {
    setEmailAddress("");
    setSelectedRoleId("");
    setFormErrors({});
  }, []);

  const resetEditForm = useCallback(() => {
    setSelectedUserId(null);
    setSelectedUserName("");
    setSelectedRoleId("");
    setFormErrors({});
  }, []);

  const resetDeleteForm = useCallback(() => {
    setSelectedUserId(null);
    setSelectedUserName("");
  }, []);

  return {
    // Data
    users,
    roles,
    isLoading,
    error,

    // State
    selectedUserId,
    selectedUserName,
    emailAddress,
    selectedRoleId,
    formErrors,
    actionLoadingStates,

    // Setters
    setSelectedUserId,
    setSelectedUserName,
    setEmailAddress,
    setSelectedRoleId,
    setFormErrors,

    // Mutations
    inviteUserMutation,
    deleteUserMutation,
    editUserRoleMutation,

    // Validation
    validateInviteForm,
    validateEditForm,

    // Reset functions
    refetch,
    resetInviteForm,
    resetEditForm,
    resetDeleteForm,
  };
};
