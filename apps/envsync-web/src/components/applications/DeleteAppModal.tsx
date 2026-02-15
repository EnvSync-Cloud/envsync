import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AlertTriangle, Trash2 } from "lucide-react";
import { App } from "@/constants";

interface DeleteAppModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  app: App | null;
  confirmText: string;
  onConfirmTextChange: (text: string) => void;
  onDelete: () => void;
  isDeleting: boolean;
}

export const DeleteAppModal = ({
  open,
  onOpenChange,
  app,
  confirmText,
  onConfirmTextChange,
  onDelete,
  isDeleting,
}: DeleteAppModalProps) => {
  if (!app) return null;

  const isConfirmValid = confirmText === app.name;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-slate-800 border-slate-700">
        <DialogHeader>
          <DialogTitle className="text-white flex items-center">
            <AlertTriangle className="w-5 h-5 text-red-500 mr-2" />
            Delete Project
          </DialogTitle>
          <DialogDescription className="text-slate-400">
            Are you sure you want to delete{" "}
            <strong className="text-white">{app.name}</strong>? This action
            cannot be undone.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="bg-red-900/20 border border-red-800 rounded-lg p-4">
            <div className="flex items-start space-x-3">
              <AlertTriangle className="w-5 h-5 text-red-400 mt-0.5 flex-shrink-0" />
              <div className="text-sm text-red-200">
                <p className="font-medium mb-1">
                  This will permanently delete:
                </p>
                <ul className="list-disc list-inside space-y-1 text-red-300">
                  <li>The project and all its configurations</li>
                  <li>All variables and secrets</li>
                  <li>All environment types and settings</li>
                  <li>Project history and audit logs</li>
                  <li>API access and integrations</li>
                </ul>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="delete-confirm" className="text-white">
              Type{" "}
              <code className="bg-slate-700 px-1 rounded text-red-400">
                {app.name}
              </code>{" "}
              to confirm:
            </Label>
            <Input
              id="delete-confirm"
              value={confirmText}
              onChange={(e) => onConfirmTextChange(e.target.value)}
              className="bg-slate-900 border-slate-700 text-white"
              placeholder="Enter project name"
              disabled={isDeleting}
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="text-white border-slate-600 hover:bg-slate-700"
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
                Delete Project
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
