import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { AlertTriangle, Trash2 } from "lucide-react";

interface DeleteAccountModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDeleteAccount: () => void;
  deleteConfirmText: string;
  setDeleteConfirmText: (text: string) => void;
  isLoading: boolean;
  userEmail?: string;
}

export const DeleteAccountModal = ({
  open,
  onOpenChange,
  onDeleteAccount,
  deleteConfirmText,
  setDeleteConfirmText,
  isLoading,
  userEmail,
}: DeleteAccountModalProps) => {
  const handleClose = () => {
    onOpenChange(false);
    setDeleteConfirmText("");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-gray-800 border-gray-700">
        <DialogHeader>
          <DialogTitle className="text-white flex items-center">
            <AlertTriangle className="w-5 h-5 text-red-500 mr-2" />
            Delete Account
          </DialogTitle>
          <DialogDescription className="text-gray-400">
            This action cannot be undone. This will permanently delete your account
            and remove all your data from our servers.
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4">
          <div className="bg-red-900/20 border border-red-800 rounded-lg p-4">
            <div className="flex items-start space-x-3">
              <AlertTriangle className="w-5 h-5 text-red-400 mt-0.5 flex-shrink-0" />
              <div className="text-sm text-red-200">
                <p className="font-medium mb-1">This will permanently delete:</p>
                <ul className="list-disc list-inside space-y-1 text-red-300">
                  <li>Your user profile and settings</li>
                  <li>All your personal data</li>
                  <li>Access to all organizations you're a member of</li>
                  <li>All your API keys and tokens</li>
                  <li>Your account history and activity logs</li>
                </ul>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="delete-confirm" className="text-white">
              Type <code className="bg-gray-700 px-1 rounded text-red-400">{userEmail}</code> to confirm:
            </Label>
            <Input
              id="delete-confirm"
              value={deleteConfirmText}
              onChange={(e) => setDeleteConfirmText(e.target.value)}
              className="bg-gray-900 border-gray-700 text-white"
              placeholder="Enter your email address"
              disabled={isLoading}
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={handleClose}
            className="text-white border-gray-600 hover:bg-gray-700"
            disabled={isLoading}
          >
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={onDeleteAccount}
            disabled={deleteConfirmText !== userEmail || isLoading}
            className="bg-red-600 hover:bg-red-700 text-white"
          >
            {isLoading ? (
              <>
                <div className="w-4 h-4 mr-2 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Deleting...
              </>
            ) : (
              <>
                <Trash2 className="w-4 h-4 mr-2" />
                Delete My Account
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
