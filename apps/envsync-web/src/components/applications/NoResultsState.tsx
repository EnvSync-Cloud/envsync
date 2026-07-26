import { Button } from "@/components/ui/button";
import { Search } from "lucide-react";

interface NoResultsStateProps {
  searchQuery: string;
  filterStatus: string;
  onResetFilters: () => void;
}

export const NoResultsState = ({ 
  searchQuery, 
  filterStatus, 
  onResetFilters 
}: NoResultsStateProps) => {
  return (
    <div className="text-center py-12">
      <Search className="w-12 h-12 text-zinc-700 mx-auto mb-4" />
      <h3 className="text-lg font-medium text-foreground mb-2">No projects found</h3>
      <p className="text-muted-foreground mb-4">
        {searchQuery && filterStatus !== 'all' 
          ? `No projects match "${searchQuery}" with status "${filterStatus}"`
          : searchQuery 
          ? `No projects match "${searchQuery}"`
          : `No projects with status "${filterStatus}"`
        }
      </p>
      <Button
        onClick={onResetFilters}
        variant="outline"
        className="text-foreground border-border hover:bg-muted"
      >
        Clear Filters
      </Button>
    </div>
  );
};
