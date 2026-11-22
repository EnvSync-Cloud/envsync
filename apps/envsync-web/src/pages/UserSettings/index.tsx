import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import { UserSettingsLoadingPage } from "./loading";
import { UserSettingsErrorPage } from "./error";
import { ProfileInformationCard } from "@/components/user-settings/ProfileInformationCard";
import { AccountSettingsCard } from "@/components/user-settings/AccountSettingsCard";
import { TwoFactorCard } from "@/components/user-settings/TwoFactorCard";
import { DangerZoneCard } from "@/components/user-settings/DangerZoneCard";
import { PasswordResetModal } from "@/components/user-settings/PasswordResetModal";
import { DeleteAccountModal } from "@/components/user-settings/DeleteAccountModal";
import { MyCertificatesCard } from "@/components/user-settings/MyCertificatesCard";
import { SignedInDevicesCard } from "@/components/user-settings/SignedInDevicesCard";
import { useUserSettings } from "@/hooks/useUserSettings";
import { useAccountSecurity } from "@/hooks/useAccountSecurity";
import { useAuthContext } from "@/contexts/auth";
import { apiKeysPath } from "@/lib/app-routes";
import { cn } from "@/lib/utils";

const NAV = [
  ["#profile", "Profile"],
  ["#password", "Password"],
  ["#security", "Two-factor auth"],
  ["#api-keys", "API keys"],
  ["#devices", "Devices"],
  ["#certificates", "Certificates"],
  ["#delete", "Delete account"],
] as const;

export const UserSettings = () => {
  const { memberships, isAuthenticated, isLoading: isAuthLoading } = useAuthContext();
  const account = useAccountSecurity(!isAuthLoading && isAuthenticated);
  const [hash, setHash] = useState("#profile");
  const {
    userData,
    isLoading,
    error,
    formData,
    formErrors,
    hasUnsavedChanges,
    logoPreview,
    fileInputRef,
    isPasswordResetDialogOpen,
    isDeleteAccountDialogOpen,
    deleteConfirmText,
    setIsPasswordResetDialogOpen,
    setIsDeleteAccountDialogOpen,
    setDeleteConfirmText,
    handleInputChange,
    handleLogoUpload,
    handleLogoRemove,
    handleSaveChanges,
    handleResetPassword,
    handleDeleteUser,
    handleResetChanges,
    updateUserSettings,
    resetPasswordMutation,
    deleteUserMutation,
  } = useUserSettings();

  useEffect(() => {
    const sync = () => setHash(window.location.hash || "#profile");
    sync();
    window.addEventListener("hashchange", sync);
    return () => window.removeEventListener("hashchange", sync);
  }, []);

  if (isLoading) {
    return <UserSettingsLoadingPage />;
  }

  if (error) {
    return <UserSettingsErrorPage />;
  }

  const lastOrganization = memberships.length <= 1;
  const deleteTitle = lastOrganization ? "Delete account" : "Leave organization";
  const deleteDescription = lastOrganization
    ? "This removes your membership. It is your only organization, so the sign-in account is deleted too."
    : "This removes your membership in the current organization. Your sign-in stays for the others.";
  const deleteAction = lastOrganization ? "Delete account" : "Leave organization";

  return (
    <div className="animate-page-enter space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-foreground">Account Settings</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">Your name, sign-in, and account.</p>
      </div>

      <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_11rem]">
        <div className="space-y-4">
          <div id="profile">
            <ProfileInformationCard
              formData={formData}
              formErrors={formErrors}
              hasUnsavedChanges={hasUnsavedChanges}
              logoPreview={logoPreview}
              fileInputRef={fileInputRef}
              signInMethods={account.security?.sign_in_methods ?? []}
              onInputChange={handleInputChange}
              onLogoUpload={handleLogoUpload}
              onLogoRemove={handleLogoRemove}
              onSaveChanges={handleSaveChanges}
              onResetChanges={handleResetChanges}
              isLoading={updateUserSettings.isPending}
            />
          </div>

          <div id="password">
            {account.securityError ? (
              <p className="mb-2 text-sm text-destructive">{account.securityError}</p>
            ) : null}
            <AccountSettingsCard
              hasPassword={account.security?.has_password ?? true}
              password={account.password}
              confirm={account.confirm}
              error={account.passwordError}
              onPassword={account.setPasswordValue}
              onConfirm={account.setConfirm}
              onSetPassword={account.submitPassword}
              onResetPassword={() => setIsPasswordResetDialogOpen(true)}
              isSetting={account.isSettingPassword}
              isResetting={resetPasswordMutation.isPending}
            />
          </div>

          <div id="security">
            <TwoFactorCard
              enabled={account.security?.mfa_enabled ?? false}
              enrollment={account.enrollment}
              code={account.code}
              error={account.mfaError}
              isWorking={account.isMfaWorking}
              onCode={account.setCode}
              onSetup={account.startMfa}
              onConfirm={account.confirmMfaCode}
              onCancel={account.cancelMfa}
              onDisable={account.disableMfa}
            />
          </div>

          <section id="api-keys" className="rounded-xl border border-border bg-card p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-lg font-semibold">Personal API keys</h2>
              <ButtonLink to={apiKeysPath()}>Create new API key</ButtonLink>
            </div>
            <p className="mt-2 text-sm text-muted-foreground">
              Keys for the CLI and API. Don't share them or put them in client-side code.
            </p>
          </section>

          <div id="devices">
            <SignedInDevicesCard />
          </div>
          <div id="certificates">
            <MyCertificatesCard />
          </div>
          <div id="delete">
            <DangerZoneCard
              title={deleteTitle}
              description={deleteDescription}
              action={deleteAction}
              onDeleteAccount={() => setIsDeleteAccountDialogOpen(true)}
              isDeleteLoading={deleteUserMutation.isPending}
            />
          </div>
        </div>

        <nav className="sticky top-6 hidden flex-col gap-1 border-l border-border text-sm lg:flex">
          {NAV.map(([href, label]) => (
            <a
              key={href}
              href={href}
              className={cn(
                "border-l-2 px-3 py-1.5",
                hash === href
                  ? "border-foreground text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground",
              )}
            >
              {label}
            </a>
          ))}
        </nav>
      </div>

      <PasswordResetModal
        open={isPasswordResetDialogOpen}
        onOpenChange={setIsPasswordResetDialogOpen}
        onResetPassword={handleResetPassword}
        isLoading={resetPasswordMutation.isPending}
        userEmail={userData?.email}
      />

      <DeleteAccountModal
        open={isDeleteAccountDialogOpen}
        onOpenChange={setIsDeleteAccountDialogOpen}
        onDeleteAccount={handleDeleteUser}
        deleteConfirmText={deleteConfirmText}
        setDeleteConfirmText={setDeleteConfirmText}
        isLoading={deleteUserMutation.isPending}
        userEmail={userData?.email}
        title={deleteTitle}
        description={deleteDescription}
        action={deleteAction}
      />
    </div>
  );
};

function ButtonLink({ to, children }: { to: string; children: string }) {
  return (
    <Link
      to={to}
      className="inline-flex h-9 items-center rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground"
    >
      {children}
    </Link>
  );
}

export default UserSettings;
