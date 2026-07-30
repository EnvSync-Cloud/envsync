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
      <DialogContent className="bg-muted border-border">
        <DialogHeader>
          <DialogTitle className="text-foreground flex items-center">
            <AlertTriangle className="w-5 h-5 text-red-500 mr-2" />
            Leave Organization
          </DialogTitle>
          <DialogDescription className="text-muted-foreground">
            This action cannot be undone for this workspace. It removes your membership from the current organization and ends your access immediately.
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4">
          <div className="bg-red-900/20 border border-red-800 rounded-lg p-4">
            <div className="flex items-start space-x-3">
              <AlertTriangle className="w-5 h-5 text-red-400 mt-0.5 flex-shrink-0" />
              <div className="text-sm text-red-200">
                <p className="font-medium mb-1">This will permanently delete:</p>
                <ul className="list-disc list-inside space-y-1 text-red-300">
                  <li>Your membership in this organization</li>
                  <li>Your access to this organization's projects and secrets</li>
                  <li>Your team memberships and org-level permissions in this workspace</li>
                </ul>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="delete-confirm" className="text-foreground">
              Type <code className="bg-muted px-1 rounded text-red-400">{userEmail}</code> to confirm:
            </Label>
            <Input
              id="delete-confirm"
              value={deleteConfirmText}
              onChange={(e) => setDeleteConfirmText(e.target.value)}
              className="bg-card border-border text-foreground"
              placeholder="Enter your email address"
              disabled={isLoading}
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={handleClose}
            className="text-foreground border-border hover:bg-muted"
            disabled={isLoading}
          >
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={onDeleteAccount}
            disabled={deleteConfirmText !== userEmail || isLoading}
            className="bg-red-600 hover:bg-red-700 text-foreground"
          >
            {isLoading ? (
              <>
                <div className="w-4 h-4 mr-2 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Deleting...
              </>
            ) : (
              <>
                <Trash2 className="w-4 h-4 mr-2" />
                Leave Organization
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
