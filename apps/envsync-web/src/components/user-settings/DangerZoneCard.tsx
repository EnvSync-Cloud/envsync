import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AlertTriangle, Trash2 } from "lucide-react";

interface DangerZoneCardProps {
  onDeleteAccount: () => void;
  isDeleteLoading: boolean;
}

export const DangerZoneCard = ({
  onDeleteAccount,
  isDeleteLoading,
}: DangerZoneCardProps) => {
  return (
    <Card className="bg-muted border-red-900 border">
      <CardHeader>
        <div className="flex items-center space-x-2">
          <AlertTriangle className="w-5 h-5 text-red-500" />
          <CardTitle className="text-red-400">Danger Zone</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h4 className="font-medium text-foreground">Leave Organization</h4>
            <p className="text-sm text-muted-foreground">
              Remove your membership from the current organization. This ends your access to this organization immediately.
            </p>
          </div>
          <Button
            variant="destructive"
            className="bg-red-600 hover:bg-red-700 text-foreground"
            onClick={onDeleteAccount}
            disabled={isDeleteLoading}
          >
            <Trash2 className="w-4 h-4 mr-2" />
            Leave Organization
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};
