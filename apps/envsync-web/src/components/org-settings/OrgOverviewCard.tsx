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
    <Card className="bg-card text-card-foreground border-border/80 shadow-xl rounded-xl">
      <CardHeader className="flex flex-row gap-2">
        <Eye className="size-8 mr-1 bg-emerald-400 border border-emerald-600 p-2 stroke-[3] text-foreground rounded-md" />
        <CardTitle className="text-foreground">Organization Overview</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-card p-4 rounded-lg">
            <div className="text-2xl font-bold text-foreground">
              {getDaysActive()}
            </div>
            <div className="text-sm text-muted-foreground">Days Active</div>
          </div>
          <div className="bg-card p-4 rounded-lg">
            <div className="text-2xl select-all font-bold text-foreground">
              {orgData?.id ? orgData.id.substring(0, 8) : "N/A"}
            </div>
            <div className="text-sm select-none text-muted-foreground">Org ID</div>
          </div>
        </div>

        <div className="space-y-2">
          <Label className="text-foreground">Created</Label>
          <div className="text-sm text-muted-foreground bg-card p-2 rounded">
            {formatDate(orgData?.created_at)}
          </div>
        </div>

        <div className="space-y-2">
          <Label className="text-foreground">Last Updated</Label>
          <div className="text-sm text-muted-foreground bg-card p-2 rounded">
            {formatDate(orgData?.updated_at)}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
