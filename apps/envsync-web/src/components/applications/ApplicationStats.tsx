import { Badge } from "@/components/ui/badge";
import { Statistics } from "@/constants";

interface ApplicationStatsProps {
  statistics: Statistics;
}

export const ApplicationStats = ({ statistics }: ApplicationStatsProps) => {
  return (
    <div className="flex items-center space-x-4 mt-3">
      <Badge variant="secondary" className="bg-slate-700 text-slate-300">
        {statistics.total} Total
      </Badge>
      <Badge variant="secondary" className="bg-emerald-500/20 text-emerald-400">
        {statistics.active} Active
      </Badge>
      {statistics.inactive > 0 && (
        <Badge variant="secondary" className="bg-slate-600 text-slate-300">
          {statistics.inactive} Inactive
        </Badge>
      )}
    </div>
  );
};
