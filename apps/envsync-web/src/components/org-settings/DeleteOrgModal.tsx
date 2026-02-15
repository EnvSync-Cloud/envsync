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

interface DeleteOrgModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orgName: string;
  confirmText: string;
  onConfirmTextChange: (text: string) => void;
  onDelete: () => void;
  isDeleting: boolean;
}

export const DeleteOrgModal = ({
  open,
  onOpenChange,
  orgName,
  confirmText,
  onConfirmTextChange,
  onDelete,
  isDeleting,
}: DeleteOrgModalProps) => {
  const isConfirmValid = confirmText === orgName;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-gray-800 border-gray-700">
        <DialogHeader>
          <DialogTitle className="text-white flex items-center">
            <AlertTriangle className="w-5 h-5 text-red-500 mr-2" />
            Delete Organization
          </DialogTitle>
          <DialogDescription className="text-gray-400">
            This action cannot be undone. This will permanently delete the{" "}
            <strong className="text-white">{orgName}</strong> organization and all associated data.
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4">
          <div className="bg-red-900/20 border border-red-800 rounded-lg p-4">
            <div className="flex items-start space-x-3">
              <AlertTriangle className="w-5 h-5 text-red-400 mt-0.5 flex-shrink-0" />
              <div className="text-sm text-red-200">
                <p className="font-medium mb-1">This will permanently delete:</p>
                <ul className="list-disc list-inside space-y-1 text-red-300">
                  <li>All organization data and settings</li>
                  <li>All projects and applications</li>
                  <li>All environment variables and configurations</li>
                  <li>All user memberships and permissions</li>
                  <li>All API keys and access tokens</li>
                  <li>All audit logs and activity history</li>
                </ul>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="delete-confirm" className="text-white">
              Type <code className="bg-gray-700 px-1 rounded text-red-400">{orgName}</code> to confirm:
            </Label>
            <Input
              id="delete-confirm"
              value={confirmText}
              onChange={(e) => onConfirmTextChange(e.target.value)}
              className="bg-gray-900 border-gray-700 text-white"
              placeholder="Enter organization name"
              disabled={isDeleting}
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="text-white border-gray-600 hover:bg-gray-700"
            disabled={isDeleting}
          >
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={onDelete}
            disabled={!isConfirmValid || isDeleting}
            className="bg-red-600 hover:bg-red-700 text-white"
          >
            {isDeleting ? (
              <>
                <div className="w-4 h-4 mr-2 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Deleting...
              </>
            ) : (
              <>
                <Trash2 className="w-4 h-4 mr-2" />
                Delete Organization
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
