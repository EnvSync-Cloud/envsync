import { UserSettingsLoadingPage } from "./loading";
import { UserSettingsErrorPage } from "./error";
import { ProfileInformationCard } from "@/components/user-settings/ProfileInformationCard";
import { AccountSettingsCard } from "@/components/user-settings/AccountSettingsCard";
import { DangerZoneCard } from "@/components/user-settings/DangerZoneCard";
import { PasswordResetModal } from "@/components/user-settings/PasswordResetModal";
import { DeleteAccountModal } from "@/components/user-settings/DeleteAccountModal";
import { useUserSettings } from "@/hooks/useUserSettings";

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
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-white">Account Settings</h1>
        <p className="text-gray-400 mt-2">
          Manage your account configuration and preferences
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
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

        <AccountSettingsCard
          emailNotifications={emailNotifications}
          setEmailNotifications={setEmailNotifications}
          onPasswordReset={() => setIsPasswordResetDialogOpen(true)}
          isPasswordResetLoading={resetPasswordMutation.isPending}
          userData={userData}
        />
      </div>

      {/* Danger Zone */}
      <DangerZoneCard
        onDeleteAccount={() => setIsDeleteAccountDialogOpen(true)}
        isDeleteLoading={deleteUserMutation.isPending}
      />

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
