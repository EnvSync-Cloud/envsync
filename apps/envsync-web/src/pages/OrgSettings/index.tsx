import { OrgSettingsLoadingPage } from "./loading";
import { OrgSettingsErrorPage } from "./error";
import { OrgSettingsHeader } from "@/components/org-settings/OrgSettingsHeader";
import { OrgInfoCard } from "@/components/org-settings//OrgInfoCard";
import { OrgOverviewCard } from "@/components/org-settings//OrgOverviewCard";
import { DangerZoneCard } from "@/components/org-settings//DangerZoneCard";
import { DeleteOrgModal } from "@/components/org-settings//DeleteOrgModal";
import { useOrgSettings } from "@/hooks/useOrgSettings";

export const OrgSettings = () => {
  const {
    // Data
    orgData,
    isLoading,
    error,
    refetch,

    // Form state
    formData,
    formErrors,
    hasUnsavedChanges,
    logoPreview,

    // Delete modal state
    isDeleteModalOpen,
    deleteConfirmText,
    setDeleteConfirmText,

    // Form handlers
    handleInputChange,
    handleLogoUpload,
    handleLogoRemove,
    handleSaveChanges,
    handleResetChanges,

    // Delete handlers
    handleOpenDeleteModal,
    handleCloseDeleteModal,
    handleDeleteOrg,

    // Loading states
    isSaving,
    isDeleting,
  } = useOrgSettings();

  if (isLoading) {
    return <OrgSettingsLoadingPage />;
  }

  if (error) {
    return <OrgSettingsErrorPage error={error} onRetry={refetch} />;
  }

  return (
    <div className="space-y-8">
      <OrgSettingsHeader orgName={orgData?.name} />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <OrgInfoCard
          formData={formData}
          formErrors={formErrors}
          hasUnsavedChanges={hasUnsavedChanges}
          orgSlug={orgData?.slug}
          onInputChange={handleInputChange}
          onLogoUpload={handleLogoUpload}
          onLogoRemove={handleLogoRemove}
          onSaveChanges={handleSaveChanges}
          onResetChanges={handleResetChanges}
          isSaving={isSaving}
          logoPreview={logoPreview}
        />

        <OrgOverviewCard orgData={orgData} />
      </div>

      <DangerZoneCard
        onDeleteClick={handleOpenDeleteModal}
        isDeleting={isDeleting}
      />

      <DeleteOrgModal
        open={isDeleteModalOpen}
        onOpenChange={handleCloseDeleteModal}
        orgName={orgData?.name || ""}
        confirmText={deleteConfirmText}
        onConfirmTextChange={setDeleteConfirmText}
        onDelete={handleDeleteOrg}
        isDeleting={isDeleting}
      />
    </div>
  );
};

export default OrgSettings;
