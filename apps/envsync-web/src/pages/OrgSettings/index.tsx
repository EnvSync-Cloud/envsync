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
                    {enterpriseSections.some((section) => section.scopeId !== "organisation-license")
                      ? "Enterprise organization settings"
                      : "License"}
                  </h2>
                  <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
                    Manage {enterpriseSections.map((section) => section.label.toLowerCase()).join(", ")} in
                    the dashboard (no separate /manage SPA).
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {enterpriseSections.map((section) => (
                    <Link
                      key={section.id}
                      to={section.href}
                      className="inline-flex items-center justify-center rounded-xl border border-emerald-400/30 bg-emerald-500/10 px-4 py-2 text-sm font-medium text-emerald-800 dark:text-emerald-100 transition-colors hover:bg-emerald-500/20"
                    >
                      {section.label}
                    </Link>
                  ))}
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
          <div className="rounded-3xl border border-border bg-card p-6">
            <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">Plan</p>
            <h2 className="mt-2 text-xl font-semibold capitalize">
              {runtimeConfig.deploymentMode === "selfhosted" && sessionPlan === "plus" ? "OSS (Plus+ included)" : sessionPlan}
            </h2>
            <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
              {runtimeConfig.deploymentMode === "selfhosted" && sessionPlan !== "enterprise"
                ? "Self-host OSS includes Plus+ workflow features (change requests, recovery, higher limits) with one organization. Enterprise is a license."
                : sessionPlan === "developer"
                  ? "Hosted free plan: 1 organization, 5 projects, 3 members. Plus+ is billed per member per month."
                  : sessionPlan === "plus"
                    ? "Plus+ is billed per member per month. Change requests, recovery, and higher limits are included."
                    : "Enterprise includes the full catalog. Contact EnvSync for changes."}
            </p>
            {runtimeConfig.deploymentMode !== "selfhosted" && sessionPlan === "developer" ? (
              <a
                href="mailto:hello@envsync.cloud?subject=Upgrade%20to%20Plus%2B"
                className="mt-4 inline-flex rounded-xl border border-emerald-400/30 bg-emerald-500/10 px-4 py-2 text-sm font-medium"
              >
                Request Plus+
              </a>
            ) : sessionPlan !== "enterprise" ? (
              <a
                href="mailto:hello@envsync.cloud?subject=Enterprise%20plan"
                className="mt-4 inline-flex rounded-xl border border-border px-4 py-2 text-sm font-medium"
              >
                Contact us for Enterprise
              </a>
            ) : null}
          </div>
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
