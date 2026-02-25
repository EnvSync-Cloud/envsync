import { useState, useCallback } from "react";
import { useQueryClient, useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { API_KEYS } from "@/constants";

interface Invitation {
  id: string;
  email: string;
  inviteToken: string;
  roleId: string;
  orgId: string;
  isAccepted: boolean;
  createdAt: string;
  updatedAt: string;
  roleName?: string;
}

interface FormErrors {
  role?: string;
}

export const useInvitations = () => {
  const { api } = useAuth();
  const queryClient = useQueryClient();

  // State management
  const [selectedInviteId, setSelectedInviteId] = useState<string | null>(null);
  const [selectedInviteEmail, setSelectedInviteEmail] = useState<string>("");
  const [selectedRoleId, setSelectedRoleId] = useState<string>("");
  const [formErrors, setFormErrors] = useState<FormErrors>({});
  const [actionLoadingStates, setActionLoadingStates] = useState<
    Record<string, boolean>
  >({});

  // Fetch invitations and roles data
  const {
    data: { invitations = [], roles = [] } = {},
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ["invitationsData"],
    queryFn: async () => {
      const [invitationsData, rolesData] = await Promise.all([
        api.onboarding.getAllUserInvites(),
        api.roles.getAllRoles(),
      ]);

      // Type assertion since SDK type is incorrect
      const invitesResponse = invitationsData as any;
      const processedInvitations = invitesResponse.invites.map((invitation: any) => ({
        id: invitation.id,
        email: invitation.email,
        inviteToken: invitation.invite_token,
        roleId: invitation.role_id,
        orgId: invitation.org_id,
        isAccepted: invitation.is_accepted,
        createdAt: new Date(invitation.created_at).toLocaleDateString("en-US", {
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
          hour: "2-digit",
          minute: "2-digit",
          hour12: true,
        }),
        updatedAt: new Date(invitation.updated_at).toLocaleDateString("en-US", {
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
          hour: "2-digit",
          minute: "2-digit",
          hour12: true,
        }),
        roleName: rolesData.find((role) => role.id === invitation.role_id)?.name || "Unknown",
      }));

      const processedRoles = rolesData.map((role) => ({
        id: role.id,
        name: role.name,
      }));

      return { invitations: processedInvitations, roles: processedRoles };
    },
    staleTime: 5 * 60 * 1000,
    retry: 3,
  });

  // Helper function to set loading state for individual actions
  const setActionLoading = useCallback((inviteId: string, loading: boolean) => {
    setActionLoadingStates((prev) => ({ ...prev, [inviteId]: loading }));
  }, []);

  // Form validation
  const validateEditForm = useCallback((): boolean => {
    const errors: FormErrors = {};

    if (!selectedRoleId) {
      errors.role = "Please select a role";
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  }, [selectedRoleId]);

  // Mutations
  const deleteInvitationMutation = useMutation({
    mutationFn: async (inviteId: string) => {
      setActionLoading(inviteId, true);
      return await api.onboarding.deleteUserInvite(inviteId);
    },
    onSuccess: (_, inviteId) => {
      queryClient.invalidateQueries({ queryKey: ["invitationsData"] });
      queryClient.invalidateQueries({ queryKey: [API_KEYS.ALL_USERS] });
      setActionLoading(inviteId, false);
      console.log("Invitation deleted successfully");
    },
    onError: (error, inviteId) => {
      console.error("Error deleting invitation:", error);
      setActionLoading(inviteId, false);
    },
  });

  const updateInvitationRoleMutation = useMutation({
    mutationFn: async ({
      inviteToken,
      roleId,
    }: {
      inviteToken: string;
      roleId: string;
    }) => {
      return await api.onboarding.updateUserInvite(inviteToken, { role_id: roleId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["invitationsData"] });
      console.log("Invitation role updated successfully");
    },
    onError: (error) => {
      console.error("Error updating invitation role:", error);
    },
  });

  // Helper functions
  const resetEditForm = useCallback(() => {
    setSelectedInviteId(null);
    setSelectedInviteEmail("");
    setSelectedRoleId("");
    setFormErrors({});
  }, []);

  const resetDeleteForm = useCallback(() => {
    setSelectedInviteId(null);
    setSelectedInviteEmail("");
  }, []);

  return {
    // Data
    invitations,
    roles,
    isLoading,
    error,

    // State
    selectedInviteId,
    selectedInviteEmail,
    selectedRoleId,
    formErrors,
    actionLoadingStates,

    // Setters
    setSelectedInviteId,
    setSelectedInviteEmail,
    setSelectedRoleId,
    setFormErrors,

    // Mutations
    deleteInvitationMutation,
    updateInvitationRoleMutation,

    // Validation
    validateEditForm,

    // Reset functions
    refetch,
    resetEditForm,
    resetDeleteForm,
  };
};
