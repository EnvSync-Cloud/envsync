import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface DangerZoneCardProps {
  title: string;
  description: string;
  action: string;
  onDeleteAccount: () => void;
  isDeleteLoading: boolean;
}

export const DangerZoneCard = ({
  title,
  description,
  action,
  onDeleteAccount,
  isDeleteLoading,
}: DangerZoneCardProps) => {
  return (
    <Card className="rounded-xl border-border bg-card text-card-foreground">
      <CardHeader>
        <CardTitle className="text-foreground">{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">{description}</p>
        <Button variant="outline" className="text-destructive" onClick={onDeleteAccount} disabled={isDeleteLoading}>
          {isDeleteLoading ? "Working..." : action}
        </Button>
      </CardContent>
    </Card>
  );
};
