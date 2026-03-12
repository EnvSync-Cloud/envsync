import { OrgSettingsLoadingPage } from "./loading";
import { OrgSettingsErrorPage } from "./error";
import { OrgSettingsHeader } from "@/components/org-settings/OrgSettingsHeader";
import { OrgInfoCard } from "@/components/org-settings//OrgInfoCard";
import { OrgOverviewCard } from "@/components/org-settings//OrgOverviewCard";
import { DangerZoneCard } from "@/components/org-settings//DangerZoneCard";
import { DeleteOrgModal } from "@/components/org-settings//DeleteOrgModal";
import { BentoGrid, BentoGridItem } from "@/components/ui/bento-grid";
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
    <div className="animate-page-enter space-y-8">
      <OrgSettingsHeader orgName={orgData?.name} />

      <BentoGrid className="md:auto-rows-auto">
        <BentoGridItem className="md:col-span-2 p-0">
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
        </BentoGridItem>

        <BentoGridItem className="md:col-span-1 p-0">
          <OrgOverviewCard orgData={orgData} />
        </BentoGridItem>

        <BentoGridItem className="md:col-span-3 p-0">
          <DangerZoneCard
            onDeleteClick={handleOpenDeleteModal}
            isDeleting={isDeleting}
          />
        </BentoGridItem>
      </BentoGrid>

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
