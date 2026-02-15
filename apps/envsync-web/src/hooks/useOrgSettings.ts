import { useState, useCallback, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import {
  FormData,
  FormErrors,
  INITIAL_FORM_DATA,
  INITIAL_FORM_ERRORS,
  MAX_FILE_SIZE,
  ACCEPTED_IMAGE_TYPES,
  MIN_ORG_NAME_LENGTH,
  EMAIL_REGEX,
} from "@/constants";

export const useOrgSettings = () => {
  const { api } = useAuth();
  const queryClient = useQueryClient();

  // State management
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [formData, setFormData] = useState<FormData>(INITIAL_FORM_DATA);
  const [formErrors, setFormErrors] = useState<FormErrors>(INITIAL_FORM_ERRORS);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);

  // Fetch organization data
  const {
    data: orgData,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ["organization"],
    queryFn: async () => {
      const data = await api.organizations.getOrg();
      return data;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    retry: 3,
  });

  // Initialize form data when org data is loaded
  const handleResetChanges = () => {
    if (orgData) {
      const initialData: FormData = {
        name: orgData.name || "",
        contact_email: orgData.metadata.contact_email || "",
        website: orgData.website || "",
        logo_url: orgData.logo_url || null,
      };

      setFormData(initialData);
      setLogoPreview(orgData.logo_url || null);
      setHasUnsavedChanges(false);
    }
  };

  useEffect(handleResetChanges, [orgData]);

  // Form validation
  const validateForm = useCallback((): boolean => {
    const errors: FormErrors = {};

    // Validate organization name
    if (!formData.name.trim()) {
      errors.name = "Organization name is required";
    } else if (formData.name.trim().length < MIN_ORG_NAME_LENGTH) {
      errors.name = `Organization name must be at least ${MIN_ORG_NAME_LENGTH} characters`;
    }

    // Validate contact email (optional but must be valid if provided)
    if (formData.contact_email && !EMAIL_REGEX.test(formData.contact_email)) {
      errors.contact_email = "Please enter a valid email address";
    }

    // Validate website URL (optional but must be valid if provided)
    if (formData.website) {
      try {
        new URL(formData.website);
      } catch {
        errors.website = "Please enter a valid website URL";
      }
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  }, [formData]);

  // Handle logo upload
  const handleLogoUpload = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) return;

      // Validate file type
      if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) {
        setFormErrors((prev) => ({
          ...prev,
          logo_url: "Please select a valid image file (PNG, JPG, GIF, WebP)",
        }));
        return;
      }

      // Validate file size
      if (file.size > MAX_FILE_SIZE) {
        setFormErrors((prev) => ({
          ...prev,
          logo_url: "File size must be less than 5MB",
        }));
        return;
      }

      // Clear any previous errors
      setFormErrors((prev) => ({ ...prev, logo_url: undefined }));

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
          logo_url: fileData.s3_url,
        }));

        setHasUnsavedChanges(true);
        toast.success("Logo uploaded successfully");
      } catch (error) {
        console.error("Logo upload failed:", error);
        setFormErrors((prev) => ({
          ...prev,
          logo_url: "Failed to upload logo. Please try again.",
        }));
        setLogoPreview(formData.logo_url); // Reset preview
        toast.error("Failed to upload logo");
      }
    },
    [api.fileUpload, formData.logo_url]
  );

  // Handle logo removal
  const handleLogoRemove = useCallback(() => {
    setLogoPreview(null);
    setFormData((prev) => ({ ...prev, logo_url: null }));
    setHasUnsavedChanges(true);
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

  // Mutation to update organization settings
  const updateOrgMutation = useMutation({
    mutationFn: async (updateData: Partial<FormData>) => {
      if (!orgData?.id) throw new Error("Organization ID not found");
      return await api.organizations.updateOrg({
        ...updateData,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["organization"] });
      setHasUnsavedChanges(false);
      toast.success("Organization settings updated successfully");
    },
    onError: (error) => {
      console.error("Failed to update organization settings:", error);
      toast.error("Failed to update organization settings");
    },
  });

  // Mutation for deleting organization
  const deleteOrgMutation = useMutation({
    mutationFn: async () => {
      if (!orgData?.id) throw new Error("Organization ID not found");
    },
    onSuccess: () => {
      toast.success("Organization deleted successfully");
      // Redirect to appropriate page after deletion
      window.location.href = "/";
    },
    onError: (error) => {
      console.error("Failed to delete organization:", error);
      toast.error("Failed to delete organization");
    },
  });

  // Handle form submission
  const handleSaveChanges = useCallback(() => {
    if (!validateForm()) return;

    const updateData = {
      name: formData.name.trim(),
      contact_email: formData.contact_email.trim() || null,
      website: formData.website.trim() || null,
      logo_url: formData.logo_url,
    };

    updateOrgMutation.mutate(updateData);
  }, [formData, validateForm, updateOrgMutation]);

  // Handle organization deletion
  const handleDeleteOrg = useCallback(() => {
    if (deleteConfirmText !== orgData?.name) {
      toast.error("Organization name does not match");
      return;
    }

    deleteOrgMutation.mutate();
  }, [deleteConfirmText, orgData?.name, deleteOrgMutation]);

  // Modal handlers
  const handleOpenDeleteModal = useCallback(() => {
    setIsDeleteModalOpen(true);
    setDeleteConfirmText("");
  }, []);

  const handleCloseDeleteModal = useCallback(() => {
    setIsDeleteModalOpen(false);
    setDeleteConfirmText("");
  }, []);

  return {
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

    // Delete handlers
    handleOpenDeleteModal,
    handleCloseDeleteModal,
    handleDeleteOrg,
    handleResetChanges,

    // Loading states
    isSaving: updateOrgMutation.isPending,
    isDeleting: deleteOrgMutation.isPending,

    // Validation
    validateForm,
  };
};
