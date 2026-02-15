import { ApplicationsLoadingPage } from "./loading";
import { ApplicationsErrorPage } from "./error";
import { ApplicationsHeader } from "@/components/applications/ApplicationsHeader";
import { ApplicationsFilters } from "@/components/applications/ApplicationsFilters";
import { ApplicationsGrid } from "@/components/applications/ApplicationsGrid";
import { ViewAppModal } from "@/components/applications/ViewAppModal";
import { EditAppModal } from "@/components/applications/EditAppModal";
import { DeleteAppModal } from "@/components/applications/DeleteAppModal";
import { useApplications } from "@/hooks/useApplications";

export const Applications = () => {
  const {
    // Data
    apps,
    statistics,
    isLoading,
    error,
    isRefetching,
    canEdit,

    // Search and filters
    searchQuery,
    debouncedSearchQuery,
    filterOptions,
    hasActiveFilters,

    // Modal states
    selectedApp,
    isViewModalOpen,
    isEditModalOpen,
    isDeleteModalOpen,
    deleteConfirmText,

    // Loading states
    isSaving,
    isDeleting,

    // Event handlers
    handleSearchChange,
    handleClearSearch,
    handleFilterChange,
    handleSortOrderToggle,
    handleResetFilters,
    handleRefresh,
    handleCreateProject,
    handleViewProject,
    handleEditProject,
    handleDeleteProject,
    handleSaveProject,
    handleConfirmDelete,
    handleCloseModals,
    setDeleteConfirmText,
  } = useApplications();

  if (isLoading) {
    return <ApplicationsLoadingPage />;
  }

  if (error) {
    return (
      <ApplicationsErrorPage
        error={error}
        onRetry={handleRefresh}
        onCreateProject={handleCreateProject}
      />
    );
  }

  return (
    <div className="space-y-8">
      <ApplicationsHeader
        statistics={statistics}
        canEdit={canEdit}
        isRefetching={isRefetching}
        onRefresh={handleRefresh}
        onCreateProject={handleCreateProject}
      />

      <ApplicationsFilters
        searchQuery={searchQuery}
        debouncedSearchQuery={debouncedSearchQuery}
        filterOptions={filterOptions}
        statistics={statistics}
        onSearchChange={handleSearchChange}
        onClearSearch={handleClearSearch}
        onFilterChange={handleFilterChange}
        onSortOrderToggle={handleSortOrderToggle}
        onResetFilters={handleResetFilters}
      />

      <ApplicationsGrid
        apps={apps}
        canEdit={canEdit}
        hasFilters={hasActiveFilters}
        searchQuery={debouncedSearchQuery}
        filterStatus={filterOptions.status}
        onView={handleViewProject}
        onEdit={handleEditProject}
        onDelete={handleDeleteProject}
        onCreateProject={handleCreateProject}
        onResetFilters={handleResetFilters}
      />

      {/* View Application Modal */}
      <ViewAppModal
        open={isViewModalOpen}
        onOpenChange={(open) => !open && handleCloseModals()}
        app={selectedApp}
        canEdit={canEdit}
        onEdit={handleEditProject}
      />

      {/* Edit Application Modal */}
      <EditAppModal
        open={isEditModalOpen}
        onOpenChange={(open) => !open && handleCloseModals()}
        app={selectedApp}
        onSave={handleSaveProject}
        isSaving={isSaving}
      />

      {/* Delete Application Modal */}
      <DeleteAppModal
        open={isDeleteModalOpen}
        onOpenChange={(open) => !open && handleCloseModals()}
        app={selectedApp}
        confirmText={deleteConfirmText}
        onConfirmTextChange={setDeleteConfirmText}
        onDelete={handleConfirmDelete}
        isDeleting={isDeleting}
      />
    </div>
  );
};

export default Applications;
