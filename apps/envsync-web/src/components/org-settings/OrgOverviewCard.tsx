import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Eye } from "lucide-react";

interface OrgData {
  id?: string;
  created_at?: string;
  updated_at?: string;
}

interface OrgOverviewCardProps {
  orgData?: OrgData;
}

export const OrgOverviewCard = ({ orgData }: OrgOverviewCardProps) => {
  const getDaysActive = () => {
    if (!orgData?.created_at) return 0;
    return Math.floor(
      (Date.now() - new Date(orgData.created_at).getTime()) /
        (1000 * 60 * 60 * 24)
    );
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return "Unknown";
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <Card className="bg-gray-800 border-gray-700">
      <CardHeader className="flex flex-row gap-2">
        <Eye className="size-8 mr-1 bg-electric_indigo-400 border border-electric_indigo-600 p-2 stroke-[3] text-white rounded-md" />
        <CardTitle className="text-white">Organization Overview</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-gray-900 p-4 rounded-lg">
            <div className="text-2xl font-bold text-white">
              {getDaysActive()}
            </div>
            <div className="text-sm text-gray-400">Days Active</div>
          </div>
          <div className="bg-gray-900 p-4 rounded-lg">
            <div className="text-2xl select-all font-bold text-white">
              {orgData?.id ? orgData.id.substring(0, 8) : "N/A"}
            </div>
            <div className="text-sm select-none text-gray-400">Org ID</div>
          </div>
        </div>

        <div className="space-y-2">
          <Label className="text-white">Created</Label>
          <div className="text-sm text-gray-300 bg-gray-900 p-2 rounded">
            {formatDate(orgData?.created_at)}
          </div>
        </div>

        <div className="space-y-2">
          <Label className="text-white">Last Updated</Label>
          <div className="text-sm text-gray-300 bg-gray-900 p-2 rounded">
            {formatDate(orgData?.updated_at)}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
