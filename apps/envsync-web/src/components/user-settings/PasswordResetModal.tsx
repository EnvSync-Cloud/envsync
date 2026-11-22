import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Key } from "lucide-react";

interface PasswordResetModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onResetPassword: () => void;
  isLoading: boolean;
  userEmail?: string;
}

export const PasswordResetModal = ({
  open,
  onOpenChange,
  onResetPassword,
  isLoading,
  userEmail,
}: PasswordResetModalProps) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-muted border-border">
        <DialogHeader>
          <DialogTitle className="text-foreground flex items-center">
            <Key className="mr-2 size-4 text-muted-foreground" />
            Reset Password
          </DialogTitle>
          <DialogDescription className="text-muted-foreground">
            A password reset link will be sent to your email address. You'll
            need to check your email and follow the instructions to set a new
            password.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="rounded-lg border border-border bg-background p-4">
            <div className="flex items-start space-x-3">
              <Key className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
              <div className="text-sm text-muted-foreground">
                <p className="mb-1 font-medium text-foreground">What happens next:</p>
                <ul className="list-inside list-disc space-y-1">
                  <li>
                    Password reset email sent to: <strong>{userEmail}</strong>
                  </li>
                  <li>Check your inbox and spam folder</li>
                  <li>Click the reset link in the email</li>
                  <li>Set your new password</li>
                </ul>
              </div>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="text-foreground border-border hover:bg-muted"
            disabled={isLoading}
          >
            Cancel
          </Button>
          <Button
            onClick={onResetPassword}
            disabled={isLoading}
          >
            {isLoading ? (
              <>
                <div className="w-4 h-4 mr-2 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Sending...
              </>
            ) : (
              <>
                <Key className="w-4 h-4 mr-2" />
                Send Reset Email
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
