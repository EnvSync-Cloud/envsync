import { Button } from "@/components/ui/button";
import { UserPlus2, Mail } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useState, useCallback, useMemo } from "react";
import { InviteUserModal } from "@/components/users/InviteUserModal";
import { EditRoleModal } from "@/components/users/EditRoleModal";
import { DeleteUserModal } from "@/components/users/DeleteUserModal";
import { InvitationsModal } from "@/components/users/InvitationsModal";
import { UsersTable } from "@/components/users/UsersTable";
import { useUsers } from "@/hooks/useUsers";

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

export const Users = () => {
  const { user } = useAuth();
  const {
    users,
    roles,
    isLoading,
    selectedUserId,
    selectedUserName,
    emailAddress,
    selectedRoleId,
    formErrors,
    actionLoadingStates,
    setSelectedUserId,
    setSelectedUserName,
    setEmailAddress,
    setSelectedRoleId,
    setFormErrors,
    inviteUserMutation,
    deleteUserMutation,
    editUserRoleMutation,
    validateInviteForm,
    validateEditForm,
    resetInviteForm,
    resetEditForm,
    resetDeleteForm,
    refetch,
  } = useUsers();

  // Dialog states
  const [showInviteUserModalOpen, setShowInviteUserModalOpen] = useState(false);
  const [showEditRoleModalOpen, setShowEditRoleModalOpen] = useState(false);
  const [showDeleteUserModalOpen, setShowDeleteUserModalOpen] = useState(false);
  const [showInvitationsModalOpen, setShowInvitationsModalOpen] = useState(false);

  // Event handlers
  const handleInviteUser = useCallback(() => {
    if (!validateInviteForm() || inviteUserMutation.isPending) return;

    inviteUserMutation.mutate({
      email: emailAddress.trim(),
      role_id: selectedRoleId,
    });
  }, [emailAddress, selectedRoleId, validateInviteForm, inviteUserMutation]);

  const handleDeleteUser = useCallback(() => {
    if (
      !selectedUserId ||
      deleteUserMutation.isPending ||
      actionLoadingStates[selectedUserId]
    )
      return;

    deleteUserMutation.mutate(selectedUserId);
  }, [selectedUserId, deleteUserMutation, actionLoadingStates]);

  const handleEditUserRole = useCallback(() => {
    if (
      !selectedUserId ||
      !validateEditForm() ||
      editUserRoleMutation.isPending ||
      actionLoadingStates[selectedUserId]
    )
      return;

    editUserRoleMutation.mutate({
      userId: selectedUserId,
      roleId: selectedRoleId,
    });
  }, [
    selectedUserId,
    selectedRoleId,
    validateEditForm,
    editUserRoleMutation,
    actionLoadingStates,
  ]);

  const handleOpenEditModal = useCallback(
    (user: User) => {
      setSelectedUserId(user.id);
      setSelectedUserName(user.name);
      setSelectedRoleId(user.roleId);
      setFormErrors({});
      setShowEditRoleModalOpen(true);
    },
    [setSelectedUserId, setSelectedUserName, setSelectedRoleId, setFormErrors]
  );

  const handleOpenDeleteModal = useCallback(
    (user: User) => {
      setSelectedUserId(user.id);
      setSelectedUserName(user.name);
      setShowDeleteUserModalOpen(true);
    },
    [setSelectedUserId, setSelectedUserName]
  );

  const handleCloseInviteModal = useCallback(() => {
    setShowInviteUserModalOpen(false);
    resetInviteForm();
  }, [resetInviteForm]);

  const handleCloseEditModal = useCallback(() => {
    setShowEditRoleModalOpen(false);
    resetEditForm();
  }, [resetEditForm]);

  const handleCloseDeleteModal = useCallback(() => {
    setShowDeleteUserModalOpen(false);
    resetDeleteForm();
  }, [resetDeleteForm]);

  const canManageUsers = useMemo(() => {
    if (!user?.role) return false;
    return user.role.is_master || user.role.is_admin;
  }, [user]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">Team</h1>
          <p className="text-gray-400 mt-2">
            Manage your team members and their access permissions
          </p>
        </div>
        {canManageUsers && (
          <div className="flex items-center space-x-3">
            <Button
              variant="outline"
              className="border-gray-600 text-gray-300 hover:bg-gray-700"
              onClick={() => setShowInvitationsModalOpen(true)}
            >
              <Mail className="size-4 mr-1" />
              Manage Invitations
            </Button>
            <Button
              className="bg-electric_indigo-500 hover:bg-electric_indigo-600 text-white"
              onClick={() => setShowInviteUserModalOpen(true)}
              disabled={inviteUserMutation.isPending}
            >
              <UserPlus2 className="size-4 mr-1" />
              Invite Member
            </Button>
          </div>
        )}
      </div>

      {/* Invite User Modal */}
      <InviteUserModal
        open={showInviteUserModalOpen}
        onOpenChange={setShowInviteUserModalOpen}
        emailAddress={emailAddress}
        setEmailAddress={setEmailAddress}
        selectedRoleId={selectedRoleId}
        setSelectedRoleId={setSelectedRoleId}
        roles={roles}
        formErrors={formErrors}
        isLoading={inviteUserMutation.isPending}
        onInvite={handleInviteUser}
        onClose={handleCloseInviteModal}
      />

      {/* Edit Role Modal */}
      <EditRoleModal
        open={showEditRoleModalOpen}
        onOpenChange={setShowEditRoleModalOpen}
        selectedUserName={selectedUserName}
        selectedRoleId={selectedRoleId}
        setSelectedRoleId={setSelectedRoleId}
        roles={roles}
        formErrors={formErrors}
        isLoading={
          editUserRoleMutation.isPending ||
          (selectedUserId ? actionLoadingStates[selectedUserId] : false)
        }
        onSave={handleEditUserRole}
        onClose={handleCloseEditModal}
      />

      {/* Delete User Modal */}
      <DeleteUserModal
        open={showDeleteUserModalOpen}
        onOpenChange={setShowDeleteUserModalOpen}
        selectedUserName={selectedUserName}
        isLoading={
          deleteUserMutation.isPending ||
          (selectedUserId ? actionLoadingStates[selectedUserId] : false)
        }
        onDelete={handleDeleteUser}
        onClose={handleCloseDeleteModal}
      />

      {/* Invitations Modal */}
      <InvitationsModal
        open={showInvitationsModalOpen}
        onOpenChange={setShowInvitationsModalOpen}
      />

      {/* Users Table */}
      <UsersTable
        users={users}
        loading={isLoading}
        actionLoadingStates={actionLoadingStates}
        canManageUsers={canManageUsers}
        onInviteClick={() => setShowInviteUserModalOpen(true)}
        onEditRole={handleOpenEditModal}
        onDeleteUser={handleOpenDeleteModal}
        refetch={refetch}
      />
    </div>
  );
};

export default Users;
