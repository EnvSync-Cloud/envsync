import { UserSettingsLoadingPage } from "./loading";
import { UserSettingsErrorPage } from "./error";
import { ProfileInformationCard } from "@/components/user-settings/ProfileInformationCard";
import { AccountSettingsCard } from "@/components/user-settings/AccountSettingsCard";
import { DangerZoneCard } from "@/components/user-settings/DangerZoneCard";
import { PasswordResetModal } from "@/components/user-settings/PasswordResetModal";
import { DeleteAccountModal } from "@/components/user-settings/DeleteAccountModal";
import { BentoGrid, BentoGridItem } from "@/components/ui/bento-grid";
import { useUserSettings } from "@/hooks/useUserSettings";
import { Settings } from "lucide-react";

export const UserSettings = () => {
  const {
    // Data
    userData,
    isLoading,
    error,

    // Form state
    formData,
    formErrors,
    hasUnsavedChanges,
    logoPreview,
    emailNotifications,

    // Dialog states
    isPasswordResetDialogOpen,
    isDeleteAccountDialogOpen,
    deleteConfirmText,

    // Refs
    fileInputRef,

    // Setters
    setEmailNotifications,
    setIsPasswordResetDialogOpen,
    setIsDeleteAccountDialogOpen,
    setDeleteConfirmText,

    // Handlers
    handleInputChange,
    handleLogoUpload,
    handleLogoRemove,
    handleSaveChanges,
    handleResetPassword,
    handleDeleteUser,
    handleResetChanges,

    // Mutations
    updateUserSettings,
    resetPasswordMutation,
    deleteUserMutation,
  } = useUserSettings();

  if (isLoading) {
    return <UserSettingsLoadingPage />;
  }

  if (error) {
    return <UserSettingsErrorPage />;
  }

  return (
    <div className="animate-page-enter space-y-8">
      <div className="flex items-center space-x-3">
        <div className="p-2 bg-violet-500/10 rounded-lg ring-1 ring-violet-500/20">
          <Settings className="size-5 text-violet-400" />
        </div>
        <div>
          <h1 className="text-xl font-semibold text-gray-100 tracking-tight">Account Settings</h1>
          <p className="text-sm text-gray-400 mt-0.5">
            Manage your account configuration and preferences
          </p>
        </div>
      </div>

      <BentoGrid className="md:auto-rows-auto">
        <BentoGridItem className="md:col-span-2 p-0">
          <ProfileInformationCard
            formData={formData}
            formErrors={formErrors}
            hasUnsavedChanges={hasUnsavedChanges}
            logoPreview={logoPreview}
            fileInputRef={fileInputRef}
            onInputChange={handleInputChange}
            onLogoUpload={handleLogoUpload}
            onLogoRemove={handleLogoRemove}
            onSaveChanges={handleSaveChanges}
            onResetChanges={handleResetChanges}
            isLoading={updateUserSettings.isPending}
          />
        </BentoGridItem>

        <BentoGridItem className="md:col-span-1 p-0">
          <AccountSettingsCard
            emailNotifications={emailNotifications}
            setEmailNotifications={setEmailNotifications}
            onPasswordReset={() => setIsPasswordResetDialogOpen(true)}
            isPasswordResetLoading={resetPasswordMutation.isPending}
            userData={userData}
          />
        </BentoGridItem>

        <BentoGridItem className="md:col-span-3 p-0">
          <DangerZoneCard
            onDeleteAccount={() => setIsDeleteAccountDialogOpen(true)}
            isDeleteLoading={deleteUserMutation.isPending}
          />
        </BentoGridItem>
      </BentoGrid>

      {/* Password Reset Modal */}
      <PasswordResetModal
        open={isPasswordResetDialogOpen}
        onOpenChange={setIsPasswordResetDialogOpen}
        onResetPassword={handleResetPassword}
        isLoading={resetPasswordMutation.isPending}
        userEmail={userData?.email}
      />

      {/* Delete Account Modal */}
      <DeleteAccountModal
        open={isDeleteAccountDialogOpen}
        onOpenChange={setIsDeleteAccountDialogOpen}
        onDeleteAccount={handleDeleteUser}
        deleteConfirmText={deleteConfirmText}
        setDeleteConfirmText={setDeleteConfirmText}
        isLoading={deleteUserMutation.isPending}
        userEmail={userData?.email}
      />
    </div>
  );
};

export default UserSettings;
