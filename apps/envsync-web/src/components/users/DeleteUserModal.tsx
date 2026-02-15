import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { AlertTriangle } from "lucide-react";

interface DeleteUserModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedUserName: string;
  isLoading: boolean;
  onDelete: () => void;
  onClose: () => void;
}

export const DeleteUserModal = ({
  open,
  onOpenChange,
  selectedUserName,
  isLoading,
  onDelete,
  onClose,
}: DeleteUserModalProps) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-gray-800 border-gray-700">
        <DialogHeader>
          <DialogTitle className="text-white flex items-center">
            <AlertTriangle className="w-5 h-5 text-red-500 mr-2" />
            Remove Team Member
          </DialogTitle>
          <DialogDescription className="text-gray-400">
            Are you sure you want to remove <strong className="text-white">{selectedUserName}</strong> from your team?
            This action cannot be undone.
          </DialogDescription>
        </DialogHeader>
        
        <div className="bg-red-900/20 border border-red-800 rounded-lg p-4">
          <div className="flex items-start space-x-3">
            <AlertTriangle className="w-5 h-5 text-red-400 mt-0.5 flex-shrink-0" />
            <div className="text-sm text-red-200">
              <p className="font-medium mb-1">This will:</p>
              <ul className="list-disc list-inside space-y-1 text-red-300">
                <li>Remove the user from your organization</li>
                <li>Revoke all their access permissions</li>
                <li>Invalidate their API keys and tokens</li>
                <li>Remove them from all projects and environments</li>
              </ul>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={onClose}
            className="text-white border-gray-600 hover:bg-gray-700"
            disabled={isLoading}
          >
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={onDelete}
            className="bg-red-600 hover:bg-red-700 text-white"
            disabled={isLoading}
          >
            {isLoading ? (
              <>
                <div className="w-4 h-4 mr-2 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Removing...
              </>
            ) : (
              "Remove User"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
