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
    <Card className="bg-gray-800 border-gray-700">
      <CardHeader>
        <div className="flex items-center space-x-2">
          <Bell className="size-8 bg-electric_indigo-400 border border-electric_indigo-600 p-2 stroke-[3] text-white rounded-md" />
          <CardTitle className="text-white">Account Settings</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h4 className="font-medium text-white">Email Notifications</h4>
            <p className="text-sm text-gray-400">
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
            <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-electric_indigo-500"></div>
          </label>
        </div>

        <div className="flex items-center justify-between">
          <div>
            <h4 className="font-medium text-white">Change Password</h4>
            <p className="text-sm text-gray-400">
              Update your account password for security
            </p>
          </div>
          <Button
            variant="outline"
            className="text-white border-gray-600 hover:bg-gray-700"
            onClick={onPasswordReset}
            disabled={isPasswordResetLoading}
          >
            <Key className="w-4 h-4 mr-2" />
            {isPasswordResetLoading ? "Resetting..." : "Reset Password"}
          </Button>
        </div>

        {/* Account Stats */}
        <div className="pt-4 border-t border-gray-700">
          <h4 className="font-medium text-white mb-3">Account Information</h4>
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-gray-900 p-3 rounded-lg">
              <div className="text-lg font-bold text-white">
                {userData?.created_at
                  ? Math.floor(
                      (Date.now() - new Date(userData.created_at).getTime()) /
                        (1000 * 60 * 60 * 24)
                    )
                  : 0}
              </div>
              <div className="text-xs text-gray-400">Days Active</div>
            </div>
            <div className="bg-gray-900 p-3 rounded-lg">
              <div className="text-lg font-bold text-white">
                {userData?.id ? userData.id.substring(0, 8) : "N/A"}
              </div>
              <div className="text-xs text-gray-400">User ID</div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
