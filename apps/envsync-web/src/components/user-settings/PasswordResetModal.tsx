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
      <DialogContent className="bg-gray-800 border-gray-700">
        <DialogHeader>
          <DialogTitle className="text-white flex items-center">
            <Key className="w-5 h-5 text-violet-500 mr-2" />
            Reset Password
          </DialogTitle>
          <DialogDescription className="text-gray-400">
            A password reset link will be sent to your email address. You'll
            need to check your email and follow the instructions to set a new
            password.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="bg-violet-900/20 border border-violet-800 rounded-lg p-4">
            <div className="flex items-start space-x-3">
              <Key className="w-5 h-5 text-violet-400 mt-0.5 flex-shrink-0" />
              <div className="text-sm text-violet-200">
                <p className="font-medium mb-1">What happens next:</p>
                <ul className="list-disc list-inside space-y-1 text-violet-300">
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
            className="text-white border-gray-600 hover:bg-gray-700"
            disabled={isLoading}
          >
            Cancel
          </Button>
          <Button
            onClick={onResetPassword}
            className="bg-violet-500 hover:bg-violet-600 text-white"
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
