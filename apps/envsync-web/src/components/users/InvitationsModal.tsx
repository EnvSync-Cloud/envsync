import React, { useState, useCallback, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Trash2, Edit3, Mail, Clock, CheckCircle, XCircle } from "lucide-react";
import { useInvitations } from "@/hooks/useInvitations";

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

interface Role {
  id: string;
  name: string;
}

interface InvitationsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const InvitationsModal: React.FC<InvitationsModalProps> = ({
  open,
  onOpenChange,
}) => {
  const {
    invitations,
    roles,
    isLoading,
    selectedInviteId,
    selectedInviteEmail,
    selectedRoleId,
    formErrors,
    actionLoadingStates,
    setSelectedInviteId,
    setSelectedInviteEmail,
    setSelectedRoleId,
    deleteInvitationMutation,
    updateInvitationRoleMutation,
    validateEditForm,
    resetEditForm,
    resetDeleteForm,
    refetch,
  } = useInvitations();

  // Refetch invitations when modal opens
  useEffect(() => {
    if (open) {
      refetch();
    }
  }, [open, refetch]);

  // Local dialog states
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);

  const handleDeleteInvitation = useCallback(() => {
    if (!selectedInviteId || deleteInvitationMutation.isPending) return;

    deleteInvitationMutation.mutate(selectedInviteId, {
      onSuccess: () => {
        setShowDeleteDialog(false);
        resetDeleteForm();
      },
    });
  }, [selectedInviteId, deleteInvitationMutation, resetDeleteForm]);

  const handleUpdateRole = useCallback(() => {
    if (!selectedInviteId || !validateEditForm() || updateInvitationRoleMutation.isPending) return;

    const invitation = invitations.find(inv => inv.id === selectedInviteId);
    if (!invitation) return;

    updateInvitationRoleMutation.mutate(
      {
        inviteToken: invitation.inviteToken,
        roleId: selectedRoleId,
      },
      {
        onSuccess: () => {
          setShowEditDialog(false);
          resetEditForm();
        },
      }
    );
  }, [selectedInviteId, selectedRoleId, validateEditForm, updateInvitationRoleMutation, invitations, resetEditForm]);

  const handleOpenDeleteDialog = useCallback((invitation: Invitation) => {
    setSelectedInviteId(invitation.id);
    setSelectedInviteEmail(invitation.email);
    setShowDeleteDialog(true);
  }, [setSelectedInviteId, setSelectedInviteEmail]);

  const handleOpenEditDialog = useCallback((invitation: Invitation) => {
    setSelectedInviteId(invitation.id);
    setSelectedInviteEmail(invitation.email);
    setSelectedRoleId(invitation.roleId);
    setShowEditDialog(true);
  }, [setSelectedInviteId, setSelectedInviteEmail, setSelectedRoleId]);

  const handleCloseDeleteDialog = useCallback(() => {
    setShowDeleteDialog(false);
    resetDeleteForm();
  }, [resetDeleteForm]);

  const handleCloseEditDialog = useCallback(() => {
    setShowEditDialog(false);
    resetEditForm();
  }, [resetEditForm]);

  const getStatusBadge = (invitation: Invitation) => {
    if (invitation.isAccepted) {
      return (
        <Badge variant="default" className="bg-green-500/20 text-green-400">
          <CheckCircle className="w-3 h-3 mr-1" />
          Accepted
        </Badge>
      );
    } else {
      return (
        <Badge variant="secondary" className="bg-yellow-500/20 text-yellow-400">
          <Clock className="w-3 h-3 mr-1" />
          Pending
        </Badge>
      );
    }
  };

  if (isLoading) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-4xl bg-gray-900 border-gray-700">
          <DialogHeader>
            <DialogTitle className="text-white">Manage Invitations</DialogTitle>
          </DialogHeader>
          <div className="flex items-center justify-center py-8">
            <div className="text-gray-400">Loading invitations...</div>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-4xl bg-gray-900 border-gray-700">
          <DialogHeader>
            <DialogTitle className="text-white">Manage Invitations</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            {invitations.length === 0 ? (
              <div className="text-center py-8">
                <Mail className="mx-auto h-12 w-12 text-gray-500 mb-4" />
                <h3 className="text-lg font-medium text-white mb-2">No invitations</h3>
                <p className="text-gray-400">There are no pending invitations at the moment.</p>
              </div>
            ) : (
              <div className="border border-gray-700 rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-gray-800 hover:bg-gray-800">
                      <TableHead className="text-gray-300">Email</TableHead>
                      <TableHead className="text-gray-300">Role</TableHead>
                      <TableHead className="text-gray-300">Status</TableHead>
                      <TableHead className="text-gray-300">Created</TableHead>
                      <TableHead className="text-gray-300">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {invitations.map((invitation) => (
                      <TableRow key={invitation.id} className="border-gray-700 hover:bg-gray-800/50">
                        <TableCell className="text-white">{invitation.email}</TableCell>
                        <TableCell className="text-gray-300">{invitation.roleName}</TableCell>
                        <TableCell>{getStatusBadge(invitation)}</TableCell>
                        <TableCell className="text-gray-400">{invitation.createdAt}</TableCell>
                        <TableCell>
                          <div className="flex items-center space-x-2">
                            {!invitation.isAccepted && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleOpenEditDialog(invitation)}
                                disabled={actionLoadingStates[invitation.id]}
                                className="border-gray-600 text-gray-300 hover:bg-gray-700"
                              >
                                <Edit3 className="w-3 h-3 mr-1" />
                                Edit Role
                              </Button>
                            )}
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleOpenDeleteDialog(invitation)}
                              disabled={actionLoadingStates[invitation.id]}
                              className="border-red-600 text-red-400 hover:bg-red-900/20"
                            >
                              <Trash2 className="w-3 h-3 mr-1" />
                              Delete
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent className="bg-gray-900 border-gray-700">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-white">Delete Invitation</AlertDialogTitle>
            <AlertDialogDescription className="text-gray-300">
              Are you sure you want to delete the invitation for{" "}
              <span className="font-semibold text-white">{selectedInviteEmail}</span>?
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              onClick={handleCloseDeleteDialog}
              className="bg-gray-700 border-gray-600 text-gray-300 hover:bg-gray-600"
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteInvitation}
              disabled={deleteInvitationMutation.isPending}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              {deleteInvitationMutation.isPending ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Edit Role Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="bg-gray-900 border-gray-700">
          <DialogHeader>
            <DialogTitle className="text-white">Change Role</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <p className="text-gray-300 mb-4">
                Change role for{" "}
                <span className="font-semibold text-white">{selectedInviteEmail}</span>
              </p>
              <Select value={selectedRoleId} onValueChange={setSelectedRoleId}>
                <SelectTrigger className="bg-gray-800 border-gray-600 text-white">
                  <SelectValue placeholder="Select a role" />
                </SelectTrigger>
                <SelectContent className="bg-gray-800 border-gray-600">
                  {roles.map((role) => (
                    <SelectItem
                      key={role.id}
                      value={role.id}
                      className="text-white hover:bg-gray-700"
                    >
                      {role.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {formErrors.role && (
                <p className="text-red-400 text-sm mt-2">{formErrors.role}</p>
              )}
            </div>
          </div>
          <div className="flex justify-end space-x-2">
            <Button
              variant="outline"
              onClick={handleCloseEditDialog}
              className="border-gray-600 text-gray-300 hover:bg-gray-700"
            >
              Cancel
            </Button>
            <Button
              onClick={handleUpdateRole}
              disabled={updateInvitationRoleMutation.isPending}
              className="bg-violet-500 hover:bg-violet-600 text-white"
            >
              {updateInvitationRoleMutation.isPending ? "Updating..." : "Update Role"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};
