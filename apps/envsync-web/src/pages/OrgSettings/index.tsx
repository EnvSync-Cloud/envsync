import { Link } from "react-router-dom";
import { OrgSettingsLoadingPage } from "./loading";
import { OrgSettingsErrorPage } from "./error";
import { OrgSettingsHeader } from "@/components/org-settings/OrgSettingsHeader";
import { OrgInfoCard } from "@/components/org-settings//OrgInfoCard";
import { DangerZoneCard } from "@/components/org-settings//DangerZoneCard";
import { DeleteOrgModal } from "@/components/org-settings//DeleteOrgModal";
import { useAuthContext } from "@/contexts/auth";
import { useOrgSettings } from "@/hooks/useOrgSettings";
import { getSettingsSections } from "@/modules/load-modules";
import { runtimeConfig } from "@/utils/runtime-config";

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
  const { allowedScopes, user } = useAuthContext();
  const sessionPlan = user?.plan ?? "developer";
  const enterpriseSections = getSettingsSections().filter((section) =>
    allowedScopes.includes(section.scopeId),
  );
  const showEnterpriseCard = runtimeConfig.edition === "enterprise" && enterpriseSections.length > 0;

  if (isLoading) {
    return <OrgSettingsLoadingPage />;
  }

  if (error) {
    return <OrgSettingsErrorPage error={error} onRetry={refetch} />;
  }

  return (
    <div className="animate-page-enter space-y-6">
      <OrgSettingsHeader orgName={orgData?.name} />

      {showEnterpriseCard && (
        <div className="flex flex-wrap gap-2">
          {enterpriseSections.map((section) => (
            <Link
              key={section.id}
              to={section.href}
              className="inline-flex items-center rounded-md border border-border px-3 py-1.5 text-sm text-foreground hover:bg-muted"
            >
              {section.label}
            </Link>
          ))}
        </div>
      )}

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

      <div className="rounded-xl border border-border bg-card p-5">
        <p className="text-xs uppercase tracking-wider text-muted-foreground">Plan</p>
        <h2 className="mt-1 text-lg font-semibold capitalize">
          {runtimeConfig.deploymentMode === "selfhosted" && sessionPlan === "plus"
            ? "OSS"
            : sessionPlan}
        </h2>
        {runtimeConfig.deploymentMode === "hosted" && sessionPlan === "developer" ? (
          <a
            href="mailto:hello@envsync.cloud?subject=Upgrade%20to%20Plus%2B"
            className="mt-3 inline-flex rounded-md border border-border px-3 py-1.5 text-sm"
          >
            Request Plus+
          </a>
        ) : null}
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
