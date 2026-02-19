import { Badge } from "@/components/ui/badge";
import { Statistics } from "@/constants";

interface ApplicationStatsProps {
  statistics: Statistics;
}

export const ApplicationStats = ({ statistics }: ApplicationStatsProps) => {
  return (
    <div className="flex items-center space-x-2 mt-2">
      <Badge variant="secondary" className="bg-gray-800 text-gray-400 text-xs">
        {statistics.total} Total
      </Badge>
      <Badge variant="secondary" className="bg-green-500/10 text-green-400 border-green-500/20 text-xs">
        {statistics.active} Active
      </Badge>
      {statistics.inactive > 0 && (
        <Badge variant="secondary" className="bg-gray-800 text-gray-500 text-xs">
          {statistics.inactive} Inactive
        </Badge>
      )}
    </div>
  );
};
