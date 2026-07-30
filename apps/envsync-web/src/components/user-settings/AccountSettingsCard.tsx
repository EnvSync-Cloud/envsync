import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Bell, Key } from "lucide-react";

interface AccountSettingsCardProps {
  emailNotifications: boolean;
  setEmailNotifications: (value: boolean) => void;
  onPasswordReset: () => void;
  isPasswordResetLoading: boolean;
  userData: any;
}

export const AccountSettingsCard = ({
  emailNotifications,
  setEmailNotifications,
  onPasswordReset,
  isPasswordResetLoading,
  userData,
}: AccountSettingsCardProps) => {
  return (
    <Card className="bg-card text-card-foreground bg-gradient-to-br from-card to-card border-border/80 shadow-xl rounded-xl">
      <CardHeader>
        <div className="flex items-center space-x-2">
          <Bell className="size-8 bg-emerald-400 border border-emerald-600 p-2 stroke-[3] text-foreground rounded-md" />
          <CardTitle className="text-foreground">Account Settings</CardTitle>
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

        {/* Account Stats */}
        <div className="pt-4 border-t border-border">
          <h4 className="font-medium text-foreground mb-3">Account Information</h4>
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-card p-3 rounded-lg">
              <div className="text-lg font-bold text-foreground">
                {userData?.created_at
                  ? Math.floor(
                      (Date.now() - new Date(userData.created_at).getTime()) /
                        (1000 * 60 * 60 * 24)
                    )
                  : 0}
              </div>
              <div className="text-xs text-muted-foreground">Days Active</div>
            </div>
            <div className="bg-card p-3 rounded-lg">
              <div className="text-lg font-bold text-foreground">
                {userData?.id ? userData.id.substring(0, 8) : "N/A"}
              </div>
              <div className="text-xs text-muted-foreground">User ID</div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
