import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AlertTriangle, Trash2 } from "lucide-react";

interface DangerZoneCardProps {
  onDeleteClick: () => void;
  isDeleting: boolean;
}

export const DangerZoneCard = ({ onDeleteClick, isDeleting }: DangerZoneCardProps) => {
  return (
    <Card className="bg-gray-800 border-red-900 border">
      <CardHeader>
        <div className="flex items-center space-x-2">
          <AlertTriangle className="w-5 h-5 text-red-500" />
          <CardTitle className="text-red-400">Danger Zone</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h4 className="font-medium text-white">Delete Organization</h4>
            <p className="text-sm text-gray-400">
              Permanently delete this organization and all associated data. This action cannot be undone.
            </p>
          </div>
          <Button
            variant="destructive"
            className="bg-red-600 hover:bg-red-700 text-white"
            onClick={onDeleteClick}
            disabled={isDeleting}
          >
            <Trash2 className="w-4 h-4 mr-2" />
            Delete Organization
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};
