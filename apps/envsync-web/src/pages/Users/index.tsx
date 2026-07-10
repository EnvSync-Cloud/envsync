import { Button } from "@/components/ui/button";
import { User, UserPlus2, ShieldCheck } from "lucide-react";
import { useAuthContext } from "@/contexts/auth";
import { useState, useCallback, useMemo } from "react";
import { PageShell } from "@/components/PageShell";
import { PageError } from "@/components/ui/page-error";
import { InviteUserModal } from "@/components/users/InviteUserModal";
import { EditRoleModal } from "@/components/users/EditRoleModal";
import { DeleteUserModal } from "@/components/users/DeleteUserModal";
import { InvitationsPanel } from "@/components/users/InvitationsPanel";
import { UsersTable } from "@/components/users/UsersTable";
import { useUsers } from "@/hooks/useUsers";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";

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
  const { user } = useAuthContext();
  const {
    users,
    roles,
    isLoading,
    error: usersError,
    refetch: refetchUsers,
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
  const [activeTab, setActiveTab] = useState("members");

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
  const activeMembers = useMemo(
    () => users.filter((member) => member.status === "active").length,
    [users]
  );
  const adminMembers = useMemo(
    () =>
      users.filter((member) => member.role.toLowerCase().includes("admin") || member.role.toLowerCase().includes("master")).length,
    [users]
  );

  if (usersError) {
    return (
      <PageError
        title="Failed to load users"
        message={usersError instanceof Error ? usersError.message : "An unexpected error occurred"}
        onRetry={() => refetchUsers()}
      />
    );
  }

  return (
    <div className="animate-page-enter space-y-6">
      <PageShell
        title="Users"
        description="Manage members, invitations, and access posture from one operational surface."
        icon={User}
        stickyActions
        actions={
          canManageUsers ? (
            <Button
              className="bg-emerald-500 hover:bg-emerald-600 text-white"
              onClick={() => setShowInviteUserModalOpen(true)}
              disabled={inviteUserMutation.isPending}
              data-testid="users-invite-member"
            >
              <UserPlus2 className="size-4 mr-2" />
              Invite Member
            </Button>
          ) : null
        }
        stats={[
          { label: "Members", value: users.length, hint: "Current organization members" },
          { label: "Active", value: activeMembers, hint: "Members active in the workspace", tone: activeMembers > 0 ? "success" : "default" },
          { label: "Privileged", value: adminMembers, hint: "Admin or master-level access", tone: adminMembers > 0 ? "warning" : "default" },
        ]}
        secondaryNav={
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="h-auto bg-transparent p-0">
              <TabsTrigger value="members" className="rounded-xl data-[state=active]:bg-emerald-500/18 data-[state=active]:text-white">
                <span data-testid="users-tab-members">Members</span>
              </TabsTrigger>
              <TabsTrigger value="invitations" className="rounded-xl data-[state=active]:bg-emerald-500/18 data-[state=active]:text-white">
                <span data-testid="users-tab-invitations">Invitations</span>
              </TabsTrigger>
            </TabsList>
          </Tabs>
        }
      >
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsContent value="members" className="mt-0" data-testid="users-members-table">
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
          </TabsContent>
          <TabsContent value="invitations" className="mt-0">
            <InvitationsPanel />
          </TabsContent>
        </Tabs>
      </PageShell>

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
    </div>
  );
};

export default Users;
