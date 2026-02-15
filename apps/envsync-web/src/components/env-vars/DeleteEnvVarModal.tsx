import { useState, useEffect, useCallback } from "react";
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
import { AlertTriangle, Trash2, Shield, Key } from "lucide-react";
import { EnvironmentVariable, EnvironmentType } from "@/constants";

interface DeleteEnvVarModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  variable: EnvironmentVariable | null;
  environmentTypes: EnvironmentType[];
  onDelete: (env_type_id: string, key: string, projectNameId: string) => void;
  isDeleting: boolean;
}

export const DeleteEnvVarModal = ({
  open,
  onOpenChange,
  variable,
  environmentTypes,
  onDelete,
  isDeleting,
}: DeleteEnvVarModalProps) => {
  const [confirmText, setConfirmText] = useState("");

  // Reset confirm text when modal opens/closes
  useEffect(() => {
    if (open) {
      setConfirmText("");
    }
  }, [open]);

  // Get environment type info
  const environmentType = variable
    ? environmentTypes.find((env) => env.id === variable.env_type_id)
    : null;

  // Handle delete confirmation
  const handleDelete = useCallback(() => {
    if (!variable || confirmText !== variable.key || isDeleting) return;
    onDelete(variable.env_type_id, variable.key, variable.app_id);
  }, [variable, confirmText, isDeleting, onDelete]);

  // Handle modal close
  const handleClose = useCallback(() => {
    onOpenChange(false);
  }, [onOpenChange]);

  if (!variable) return null;

  const isConfirmValid = confirmText === variable.key;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-slate-800 border-slate-700 max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-white flex items-center">
            <AlertTriangle className="w-5 h-5 text-red-500 mr-2" />
            Delete {variable.sensitive ? "Secret" : "Variable"}:{" "}
          </DialogTitle>
          <DialogDescription className="text-slate-400">
            This action cannot be undone. This will permanently delete the
            {variable.sensitive ? " secret" : " variable"} and remove it from all deployments.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Variable Info */}
          <div className="bg-slate-900 rounded-lg p-4 border border-slate-700">
            <h4 className="text-sm font-medium text-white mb-3">
              Variable Details
            </h4>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-400">Key:</span>
                <code className="text-sm font-mono text-emerald-400 bg-slate-800 px-2 py-1 rounded">
                  {variable.key}
                </code>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-400">Environment:</span>
                {environmentType && (
                  <div className="flex items-center space-x-2">
                    <div
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: environmentType.color }}
                    />
                    <span className="text-sm text-white">
                      {environmentType.name}
                    </span>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-400">Type:</span>
                <div
                  className={`flex items-center space-x-1 text-xs px-2 py-1 rounded ${
                    variable.sensitive
                      ? "bg-red-900/20 text-red-400"
                      : "bg-slate-700 text-slate-300"
                  }`}
                >
                  {variable.sensitive ? (
                    <Shield className="w-3 h-3" />
                  ) : (
                    <Key className="w-3 h-3" />
                  )}
                  <span>{variable.sensitive ? "Secret" : "Variable"}</span>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-400">Value:</span>
                <code className="text-sm font-mono text-slate-300 bg-slate-800 px-2 py-1 rounded max-w-xs truncate">
                  {variable.sensitive ? "••••••••" : variable.value}
                </code>
              </div>
            </div>
          </div>

          {/* Warning */}
          <div className="bg-red-900/20 border border-red-800 rounded-lg p-4">
            <div className="flex items-start space-x-3">
              <AlertTriangle className="w-5 h-5 text-red-400 mt-0.5 flex-shrink-0" />
              <div className="text-sm text-red-200">
                <p className="font-medium mb-1">This will permanently:</p>
                <ul className="list-disc list-inside space-y-1 text-red-300">
                  <li>Delete the {variable.sensitive ? "secret" : "variable"} from all environments</li>
                  <li>Remove it from any active deployments</li>
                  <li>
                    Clear the {variable.sensitive ? "secret" : "variable"} from build and runtime configurations
                  </li>
                </ul>
              </div>
            </div>
          </div>

          {/* Confirmation Input */}
          <div className="space-y-2">
            <Label htmlFor="delete-confirm" className="text-white">
              Type{" "}
              <code className="bg-slate-700 px-1 rounded text-red-400">
                {variable.key}
              </code>{" "}
              to confirm:
            </Label>
            <Input
              id="delete-confirm"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              className={`bg-slate-900 border-slate-700 text-white font-mono ${
                confirmText && !isConfirmValid ? "border-red-500" : ""
              }`}
              placeholder="Enter the Key"
              disabled={isDeleting}
            />
            {confirmText && !isConfirmValid && (
              <p className="text-red-400 text-sm">Key doesn't match</p>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={handleClose}
            className="text-white border-slate-600 hover:bg-slate-700"
            disabled={isDeleting}
          >
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={handleDelete}
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
                Delete {variable.sensitive ? "Secret" : "Variable"}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
