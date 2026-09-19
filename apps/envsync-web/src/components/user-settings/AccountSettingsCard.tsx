import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Bell, Key } from "lucide-react";

interface AccountSettingsCardProps {
  emailNotifications: boolean;
  setEmailNotifications: (value: boolean) => void;
  onPasswordReset: () => void;
  isPasswordResetLoading: boolean;
}

export const AccountSettingsCard = ({
  emailNotifications,
  setEmailNotifications,
  onPasswordReset,
  isPasswordResetLoading,
}: AccountSettingsCardProps) => {
  return (
    <Card className="border-border bg-card text-card-foreground rounded-xl">
      <CardHeader>
        <div className="flex items-center space-x-2">
          <Bell className="size-8 bg-emerald-400 border border-emerald-600 p-2 stroke-[3] text-foreground rounded-md" />
          <CardTitle className="text-foreground">Preferences</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h4 className="font-medium text-foreground">Email Notifications</h4>
            <p className="text-sm text-muted-foreground">
              Receive updates and alerts via email
            </p>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              className="sr-only peer"
              checked={emailNotifications}
              onChange={(e) => setEmailNotifications(e.target.checked)}
            />
            <div className="w-11 h-6 bg-muted peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500"></div>
          </label>
        </div>

        <div className="flex items-center justify-between">
          <div>
            <h4 className="font-medium text-foreground">Change Password</h4>
            <p className="text-sm text-muted-foreground">
              Update your account password for security
            </p>
          </div>
          <Button
            variant="outline"
            className="text-foreground border-border hover:bg-muted"
            onClick={onPasswordReset}
            disabled={isPasswordResetLoading}
          >
            <Key className="w-4 h-4 mr-2" />
            {isPasswordResetLoading ? "Resetting..." : "Reset Password"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};
