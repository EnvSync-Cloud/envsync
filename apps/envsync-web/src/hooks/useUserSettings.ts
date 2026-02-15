import { useState, useCallback, useEffect, useRef } from "react";
import { useQueryClient, useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { UpdateUserRequest } from "@envsync-cloud/envsync-ts-sdk";

interface FormData {
  name: string;
  email: string;
  profile_picture_url: string | null;
}

interface FormErrors {
  name?: string;
  email?: string;
  profile_picture_url?: string;
}

export const useUserSettings = () => {
  const { api } = useAuth();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // State management
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [formData, setFormData] = useState<FormData>({
    name: "",
    email: "",
    profile_picture_url: null,
  });
  const [formErrors, setFormErrors] = useState<FormErrors>({});
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [emailNotifications, setEmailNotifications] = useState(true);

  // Dialog states
  const [isPasswordResetDialogOpen, setIsPasswordResetDialogOpen] =
    useState(false);
  const [isDeleteAccountDialogOpen, setIsDeleteAccountDialogOpen] =
    useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");

  // Fetch user data
  const {
    data: userData,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["userInfo"],
    queryFn: async () => {
      const { user: userData } = await api.authentication.whoami();
      return userData;
    },
    staleTime: 5 * 60 * 1000,
    retry: 3,
  });

  const handleResetChanges = () => {
    if (userData) {
      const initialData = {
        name: userData.full_name || "",
        email: userData.email || "",
        profile_picture_url: userData.profile_picture_url || null,
      };

      setFormData(initialData);
      setLogoPreview(userData.profile_picture_url || null);
      setHasUnsavedChanges(false);
    }
  };

  // Initialize form data when user data is loaded
  useEffect(handleResetChanges, [userData]);

  // Form validation
  const validateForm = useCallback((): boolean => {
    const errors: FormErrors = {};

    if (!formData.name.trim()) {
      errors.name = "Full name is required";
    } else if (formData.name.trim().length < 2) {
      errors.name = "Full name must be at least 2 characters";
    }

    if (!formData.email.trim()) {
      errors.email = "Email address is required";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      errors.email = "Please enter a valid email address";
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  }, [formData]);

  // Handle profile picture upload
  const handleLogoUpload = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) return;

      // Validate file type
      if (!file.type.startsWith("image/")) {
        setFormErrors((prev) => ({
          ...prev,
          profile_picture_url: "Please select an image file",
        }));
        return;
      }

      // Validate file size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        setFormErrors((prev) => ({
          ...prev,
          profile_picture_url: "File size must be less than 5MB",
        }));
        return;
      }

      // Clear any previous errors
      setFormErrors((prev) => ({ ...prev, profile_picture_url: undefined }));

      try {
        // Create preview
        const reader = new FileReader();
        reader.onload = (e) => {
          setLogoPreview(e.target?.result as string);
        };
        reader.readAsDataURL(file);

        // Upload file
        const fileData = await api.fileUpload.uploadFile({ file });

        // Update form data
        setFormData((prev) => ({
          ...prev,
          profile_picture_url: fileData.s3_url,
        }));

        setHasUnsavedChanges(true);
      } catch (error) {
        console.error("Profile picture upload failed:", error);
        setFormErrors((prev) => ({
          ...prev,
          profile_picture_url:
            "Failed to upload profile picture. Please try again.",
        }));
        setLogoPreview(formData.profile_picture_url);
      }
    },
    [api.fileUpload, formData.profile_picture_url]
  );

  // Handle profile picture removal
  const handleLogoRemove = useCallback(() => {
    setLogoPreview(null);
    setFormData((prev) => ({ ...prev, profile_picture_url: null }));
    setHasUnsavedChanges(true);

    // Clear file input
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }, []);

  // Handle form input changes
  const handleInputChange = useCallback(
    (field: keyof FormData, value: string) => {
      setFormData((prev) => ({ ...prev, [field]: value }));
      setHasUnsavedChanges(true);

      // Clear field error when user starts typing
      if (formErrors[field]) {
        setFormErrors((prev) => ({ ...prev, [field]: undefined }));
      }
    },
    [formErrors]
  );

  // Mutation to update user settings
  const updateUserSettings = useMutation({
    mutationFn: async (settings: UpdateUserRequest) => {
      if (!userData?.id) throw new Error("User ID not found");
      return await api.users.updateUser(userData.id, settings);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["userInfo"] });
      setHasUnsavedChanges(false);
      console.log("User settings updated successfully");
    },
    onError: (error) => {
      console.error("Failed to update user settings:", error);
    },
  });

  // Mutation to reset password
  const resetPasswordMutation = useMutation({
    mutationFn: async () => {
      if (!userData?.id) throw new Error("User ID not found");
      return await api.users.updatePassword(userData.id);
    },
    onSuccess: () => {
      console.log("Password reset successfully");
      setIsPasswordResetDialogOpen(false);
    },
    onError: (error) => {
      console.error("Failed to reset password:", error);
    },
  });

  // Mutation for deleting user account
  const deleteUserMutation = useMutation({
    mutationFn: async () => {
      if (!userData?.id) throw new Error("User ID not found");
      return await api.users.deleteUser(userData.id);
    },
    onSuccess: () => {
      console.log("User account deleted successfully");
      window.location.href = "/login";
    },
    onError: (error) => {
      console.error("Failed to delete user account:", error);
    },
  });

  // Handle form submission
  const handleSaveChanges = useCallback(() => {
    if (!validateForm()) return;

    const updateData: UpdateUserRequest = {
      full_name: formData.name.trim(),
      email: formData.email.trim(),
      profile_picture_url: formData.profile_picture_url,
    };

    updateUserSettings.mutate(updateData);
  }, [formData, validateForm, updateUserSettings]);

  // Handle password reset
  const handleResetPassword = useCallback(() => {
    resetPasswordMutation.mutate();
  }, [resetPasswordMutation]);

  // Handle account deletion
  const handleDeleteUser = useCallback(() => {
    if (deleteConfirmText !== userData?.email) {
      return;
    }

    deleteUserMutation.mutate();
    setIsDeleteAccountDialogOpen(false);
  }, [deleteConfirmText, userData?.email, deleteUserMutation]);

  return {
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

    // Validation
    validateForm,
  };
};
