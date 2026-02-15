import { ApplicationCard } from "./ApplicationCard";
import { EmptyState } from "./EmptyState";
import { NoResultsState } from "./NoResultsState";
import { App } from "@/constants";

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
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
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
    </div>
  );
};
