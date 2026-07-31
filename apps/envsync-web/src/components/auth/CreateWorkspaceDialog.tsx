import { useEffect, useState } from "react";

import { useAuthContext } from "@/contexts/auth";
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

interface CreateWorkspaceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const CreateWorkspaceDialog = ({
  open,
  onOpenChange,
}: CreateWorkspaceDialogProps) => {
  const { createWorkspace, isCreatingWorkspace } = useAuthContext();
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setName("");
      setError(null);
    }
  }, [open]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmedName = name.trim();

    if (!trimmedName) {
      setError("Organization name is required.");
      return;
    }

    if (trimmedName.length > 120) {
      setError("Organization name must be 120 characters or fewer.");
      return;
    }

    setError(null);

    try {
      await createWorkspace(trimmedName);
      onOpenChange(false);
    } catch (submissionError) {
      setError(
        submissionError instanceof Error
          ? submissionError.message
          : "Failed to create organization.",
      );
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="border-border bg-card text-foreground sm:max-w-md"
        data-testid="create-workspace-dialog"
      >
        <DialogHeader>
          <DialogTitle>Create organization</DialogTitle>
          <DialogDescription className="text-muted-foreground">
            Create a new organization and switch into it immediately. Available on Hosted only.
          </DialogDescription>
        </DialogHeader>

        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="space-y-2">
            <Label htmlFor="workspace-name" className="text-foreground">
              Organization name
            </Label>
            <Input
              id="workspace-name"
              data-testid="create-workspace-name-input"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Acme Platform"
              autoFocus
              maxLength={120}
              disabled={isCreatingWorkspace}
              className="border-border bg-card text-foreground placeholder:text-tertiary"
            />
          </div>

          {error && (
            <div
              data-testid="create-workspace-error"
              className="rounded-lg border border-rose-500/20 bg-rose-500/10 px-3 py-2 text-sm text-rose-200"
            >
              {error}
            </div>
          )}

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isCreatingWorkspace}
              className="border-border bg-transparent text-muted-foreground hover:bg-card hover:text-foreground"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              data-testid="create-workspace-submit"
              disabled={isCreatingWorkspace}
              className="bg-emerald-500 text-black hover:bg-emerald-400"
            >
              {isCreatingWorkspace ? "Creating..." : "Create organization"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
