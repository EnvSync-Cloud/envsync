import { ApplicationCard } from "./ApplicationCard";
import { EmptyState } from "./EmptyState";
import { NoResultsState } from "./NoResultsState";
import { App } from "@/constants";
import { Table, TableBody, TableHead, TableHeader, TableRow } from "@/components/ui/table";

interface ApplicationsGridProps {
  apps: App[];
  canEdit: boolean;
  hasFilters: boolean;
  searchQuery: string;
  filterStatus: string;
  onView: (app: App) => void;
  onEdit: (app: App) => void;
  onDelete: (app: App) => void;
  onCreateProject: () => void;
  onResetFilters: () => void;
}

export const ApplicationsGrid = ({
  apps,
  canEdit,
  hasFilters,
  searchQuery,
  filterStatus,
  onView,
  onEdit,
  onDelete,
  onCreateProject,
  onResetFilters,
}: ApplicationsGridProps) => {
  if (apps.length === 0) {
    if (hasFilters) {
      return (
        <NoResultsState
          searchQuery={searchQuery}
          filterStatus={filterStatus}
          onResetFilters={onResetFilters}
        />
      );
    }

    return <EmptyState canEdit={canEdit} onCreateProject={onCreateProject} />;
  }

  return (
    <div className="overflow-hidden rounded-lg border border-border">
      <Table>
        <TableHeader>
          <TableRow className="border-border hover:bg-transparent">
            <TableHead className="text-muted-foreground">Name</TableHead>
            <TableHead className="text-right text-muted-foreground">Variables</TableHead>
            <TableHead className="text-right text-muted-foreground">Secrets</TableHead>
            <TableHead className="text-muted-foreground">Updated</TableHead>
            {canEdit ? <TableHead className="w-12" /> : null}
          </TableRow>
        </TableHeader>
        <TableBody>
          {apps.map((app) => (
            <ApplicationCard
              key={app.id}
              app={app}
              canEdit={canEdit}
              onView={onView}
              onEdit={onEdit}
              onDelete={onDelete}
            />
          ))}
        </TableBody>
      </Table>
    </div>
  );
};
