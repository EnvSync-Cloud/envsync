import { Link } from "react-router-dom";
import { OrgSettingsLoadingPage } from "./loading";
import { OrgSettingsErrorPage } from "./error";
import { OrgSettingsHeader } from "@/components/org-settings/OrgSettingsHeader";
import { OrgInfoCard } from "@/components/org-settings//OrgInfoCard";
import { OrgOverviewCard } from "@/components/org-settings//OrgOverviewCard";
import { DangerZoneCard } from "@/components/org-settings//DangerZoneCard";
import { DeleteOrgModal } from "@/components/org-settings//DeleteOrgModal";
import { BentoGrid, BentoGridItem } from "@/components/ui/bento-grid";
import { useAuthContext } from "@/contexts/auth";
import { useOrgSettings } from "@/hooks/useOrgSettings";
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
  const { allowedScopes } = useAuthContext();
  const showIntegrations = allowedScopes.includes("organisation-integrations");
  const showSync = allowedScopes.includes("organisation-sync");
  const showLicense = allowedScopes.includes("organisation-license");
  const showSso = allowedScopes.includes("organisation-sso");
  const showKeys = allowedScopes.includes("organisation-keys");
  const showEnterpriseCard =
    runtimeConfig.edition === "enterprise"
    && (showIntegrations || showSync || showLicense || showSso || showKeys);

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
        {showEnterpriseCard && (
          <BentoGridItem className="md:col-span-3 p-0">
            <div className="rounded-3xl border border-emerald-500/20 bg-emerald-500/8 p-6">
              <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="text-xs uppercase tracking-[0.22em] text-emerald-600 dark:text-emerald-200/80">Enterprise</p>
                  <h2 className="mt-2 text-xl font-semibold text-foreground">
                    {showIntegrations || showSync || showSso || showKeys
                      ? "Enterprise organization settings"
                      : "License"}
                  </h2>
                  <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
                    {showSso || showIntegrations || showSync || showKeys
                      ? [
                          "Manage",
                          [
                            showSso && "SSO",
                            (showIntegrations || showSync) && "provider connections",
                            showKeys && "organization keys",
                            (showIntegrations || showSync) && "org secrets",
                            showSync && "sync diagnostics",
                            showLicense && "license activation",
                          ].filter(Boolean).join(", "),
                          "in the dashboard (no separate /manage SPA).",
                        ].join(" ")
                      : "Activate or verify the enterprise entitlement for this install."}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {showIntegrations && (
                    <Link
                      to="/organisation/integrations"
                      className="inline-flex items-center justify-center rounded-xl border border-emerald-400/30 bg-emerald-500/15 px-4 py-2 text-sm font-medium text-emerald-800 dark:text-emerald-100 transition-colors hover:bg-emerald-500/20"
                    >
                      Integrations
                    </Link>
                  )}
                  {showSync && (
                    <Link
                      to="/organisation/sync"
                      className="inline-flex items-center justify-center rounded-xl border border-emerald-400/30 bg-emerald-500/10 px-4 py-2 text-sm font-medium text-emerald-800 dark:text-emerald-100 transition-colors hover:bg-emerald-500/20"
                    >
                      Sync ops
                    </Link>
                  )}
                  {showSso && (
                    <Link
                      to="/organisation/sso"
                      className="inline-flex items-center justify-center rounded-xl border border-emerald-400/30 bg-emerald-500/10 px-4 py-2 text-sm font-medium text-emerald-800 dark:text-emerald-100 transition-colors hover:bg-emerald-500/20"
                    >
                      SSO
                    </Link>
                  )}
                  {showKeys && (
                    <Link
                      to="/organisation/keys"
                      className="inline-flex items-center justify-center rounded-xl border border-emerald-400/30 bg-emerald-500/10 px-4 py-2 text-sm font-medium text-emerald-800 dark:text-emerald-100 transition-colors hover:bg-emerald-500/20"
                    >
                      Key management
                    </Link>
                  )}
                  {showLicense && (
                    <Link
                      to="/organisation/license"
                      className="inline-flex items-center justify-center rounded-xl border border-emerald-400/30 bg-emerald-500/10 px-4 py-2 text-sm font-medium text-emerald-800 dark:text-emerald-100 transition-colors hover:bg-emerald-500/20"
                    >
                      License
                    </Link>
                  )}
                </div>
              </div>
            </div>
          </BentoGridItem>
        )}

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
