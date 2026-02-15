import { useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  ArrowLeft,
  Settings,
  Palette,
  Save,
  Trash2,
  AlertTriangle,
  Plus,
  Edit3,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useAuth } from "@/hooks/useAuth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

interface EnvironmentType {
  id: string;
  name: string;
  color: string;
  is_default: boolean;
  is_protected: boolean;
  variable_count?: number;
}

interface Project {
  id: string;
  name: string;
  description?: string;
  env_types?: EnvironmentType[];
}

interface FormData {
  name: string;
  color: string;
  is_default: boolean;
  is_protected: boolean;
  variable_count?: number;
}

interface FormErrors {
  name?: string;
  color?: string;
}

const MAX_NAME_LENGTH = 50;
const ENV_NAME_REGEX = /^[a-zA-Z0-9][a-zA-Z0-9-_\s]*[a-zA-Z0-9]$/;

const PRESET_COLORS = [
  "#ef4444", // red
  "#f97316", // orange
  "#eab308", // yellow
  "#22c55e", // green
  "#06b6d4", // cyan
  "#3b82f6", // blue
  "#6366f1", // indigo
  "#8b5cf6", // violet
  "#ec4899", // pink
  "#f59e0b", // amber
];

export const ManageEnvironment = () => {
  const { projectNameId } = useParams<{
    projectNameId: string;
  }>();
  const navigate = useNavigate();
  const { api } = useAuth();
  const queryClient = useQueryClient();

  // State
  const [selectedEnvironment, setSelectedEnvironment] =
    useState<EnvironmentType | null>(null);
  const [formData, setFormData] = useState<FormData>({
    name: "",
    color: "#6366f1",
    is_default: false,
    is_protected: false,
  });
  const [formErrors, setFormErrors] = useState<FormErrors>({});
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["project-environments/manage", projectNameId],
    queryFn: async () => {
      const projectResponse = await api.applications.getApp(projectNameId);
      const envTypesResponse = projectResponse.env_types || [];

      // Map environment types to the expected format
      const envTypesWithCount = await Promise.all(
        envTypesResponse.map(async (envType) => {
          const variables = await api.environmentVariables.getEnvs({
            app_id: projectNameId,
            env_type_id: envType.id,
          });
          // Ensure variables is an array
          return {
            ...envType,
            variable_count: variables.length,
          };
        })
      );

      const project: Project = {
        id: projectResponse.id,
        name: projectResponse.name,
        description: projectResponse.description,
        env_types: envTypesWithCount,
      };

      return {
        project,
        environmentTypes: envTypesResponse,
      };
    },
    enabled: !!projectNameId,
    staleTime: 30 * 1000,
  });

  // Form validation
  const validateForm = useCallback((): boolean => {
    const errors: FormErrors = {};

    if (!formData.name.trim()) {
      errors.name = "Environment name is required";
    } else if (formData.name.trim().length < 2) {
      errors.name = "Environment name must be at least 2 characters";
    } else if (formData.name.length > MAX_NAME_LENGTH) {
      errors.name = `Environment name must be less than ${MAX_NAME_LENGTH} characters`;
    } else if (!ENV_NAME_REGEX.test(formData.name.trim())) {
      errors.name =
        "Environment name can only contain letters, numbers, spaces, hyphens, and underscores";
    }

    if (!formData.color || !/^#[0-9A-F]{6}$/i.test(formData.color)) {
      errors.color = "Please select a valid color";
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  }, [formData]);

  // Handle input changes
  const handleInputChange = useCallback(
    (field: keyof FormData, value: string | boolean) => {
      setFormData((prev) => ({ ...prev, [field]: value }));

      // Clear field error when user starts typing
      if (typeof value === "string" && formErrors[field as keyof FormErrors]) {
        setFormErrors((prev) => ({ ...prev, [field]: undefined }));
      }
    },
    [formErrors]
  );

  // Create environment type mutation
  const createEnvironmentType = useMutation({
    mutationFn: async (data: FormData) => {
      return await api.environmentTypes.createEnvType({
        name: data.name.trim(),
        color: data.color,
        is_default: data.is_default,
        is_protected: data.is_protected,
        app_id: projectNameId!,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["project-environments", projectNameId],
      });
      queryClient.invalidateQueries({
        queryKey: ["project-environments/manage", projectNameId],
      });
      setShowCreateDialog(false);
      resetForm();
      toast.success("Environment type created successfully");
    },
    onError: (error) => {
      console.error("Failed to create environment type:", error);
      toast.error("Failed to create environment type");
    },
  });

  // Update environment type mutation
  const updateEnvironmentType = useMutation({
    mutationFn: async (data: FormData) => {
      if (!selectedEnvironment) throw new Error("No environment selected");
      return await api.environmentTypes.updateEnvType(selectedEnvironment.id, {
        id: selectedEnvironment.id,
        name: data.name.trim(),
        color: data.color,
        is_default: data.is_default,
        is_protected: data.is_protected,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["project-environments", projectNameId],
      });
      queryClient.invalidateQueries({
        queryKey: ["project-environments/manage", projectNameId],
      });
      setShowEditDialog(false);
      setSelectedEnvironment(null);
      resetForm();
      toast.success("Environment type updated successfully");
    },
    onError: (error) => {
      console.error("Failed to update environment type:", error);
      toast.error("Failed to update environment type");
    },
  });

  // Delete environment type mutation
  const deleteEnvironmentType = useMutation({
    mutationFn: async () => {
      if (!selectedEnvironment) throw new Error("No environment selected");
      return await api.environmentTypes.deleteEnvType(selectedEnvironment.id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["project-environments", projectNameId],
      });
      queryClient.invalidateQueries({
        queryKey: ["project-environments/manage", projectNameId],
      });
      setShowDeleteDialog(false);
      setSelectedEnvironment(null);
      setDeleteConfirmText("");
      toast.success("Environment type deleted successfully");
    },
    onError: (error) => {
      console.error("Failed to delete environment type:", error);
      toast.error("Failed to delete environment type");
    },
  });

  // Helper functions
  const resetForm = useCallback(() => {
    setFormData({
      name: "",
      color: "#6366f1",
      is_default: false,
      is_protected: false,
    });
    setFormErrors({});
  }, []);

  const openCreateDialog = useCallback(() => {
    resetForm();
    setShowCreateDialog(true);
  }, [resetForm]);

  const openEditDialog = useCallback((environment: EnvironmentType) => {
    setSelectedEnvironment(environment);
    setFormData({
      name: environment.name,
      color: environment.color,
      is_default: environment.is_default,
      is_protected: environment.is_protected,
    });
    setFormErrors({});
    setShowEditDialog(true);
  }, []);

  const openDeleteDialog = useCallback((environment: EnvironmentType) => {
    setSelectedEnvironment(environment);
    setDeleteConfirmText("");
    setShowDeleteDialog(true);
  }, []);

  // Handle form submissions
  const handleCreate = useCallback(() => {
    if (!validateForm() || createEnvironmentType.isPending) return;
    createEnvironmentType.mutate(formData);
  }, [formData, validateForm, createEnvironmentType]);

  const handleUpdate = useCallback(() => {
    if (!validateForm() || updateEnvironmentType.isPending) return;
    updateEnvironmentType.mutate(formData);
  }, [formData, validateForm, updateEnvironmentType]);

  const handleDelete = useCallback(() => {
    if (
      deleteConfirmText !== selectedEnvironment?.name ||
      deleteEnvironmentType.isPending
    )
      return;
    deleteEnvironmentType.mutate();
  }, [deleteConfirmText, selectedEnvironment?.name, deleteEnvironmentType]);

  // Handle back navigation
  const handleBack = useCallback(() => {
    navigate(`/applications/${projectNameId}`);
  }, [navigate, projectNameId]);

  // Loading state
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center space-y-4">
          <div className="size-12 border-4 border-t-emerald-500 border-slate-700 rounded-full animate-spin"></div>
          <p className="text-slate-400">Loading environment types...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error || !data) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center space-y-4 text-center">
          <AlertTriangle className="w-12 h-12 text-red-400" />
          <div>
            <h3 className="text-lg font-semibold text-white mb-2">
              Failed to load project
            </h3>
            <p className="text-slate-400 mb-4">
              The requested project could not be found or you don't have access
              to it.
            </p>
            <Button
              onClick={() => refetch()}
              className="bg-emerald-500 hover:bg-emerald-600 text-white mr-2"
            >
              Try Again
            </Button>
            <Button
              onClick={handleBack}
              variant="outline"
              className="text-white border-slate-600 hover:bg-slate-700"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Go Back
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const { project, environmentTypes } = data;

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Button
            onClick={handleBack}
            variant="ghost"
            size="sm"
            className="text-slate-400 hover:text-white hover:bg-slate-700"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Project
          </Button>
          <div>
            <h1 className="text-3xl font-bold text-white">
              Manage Environments
            </h1>
            <p className="text-slate-400 mt-2">
              Configure environment types for{" "}
              <span className="text-emerald-400 font-medium">
                {project.name}
              </span>
            </p>
          </div>
        </div>
        <Button
          onClick={openCreateDialog}
          className="bg-emerald-500 hover:bg-emerald-600 text-white"
        >
          <Plus className="w-4 h-4 mr-2" />
          Add Environment Type
        </Button>
      </div>

      {/* Environment Types Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {environmentTypes.map((envType) => (
          <Card
            key={envType.id}
            className="bg-slate-800 border-slate-700 hover:border-slate-600 transition-colors"
          >
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div
                    className="w-4 h-4 rounded-full"
                    style={{ backgroundColor: envType.color }}
                  />
                  <CardTitle className="text-white text-lg">
                    {envType.name}
                  </CardTitle>
                </div>
                <div className="flex items-center space-x-1">
                  {envType.is_default && (
                    <span className="px-2 py-1 text-xs bg-emerald-500/20 text-emerald-400 rounded-full">
                      Default
                    </span>
                  )}
                  {envType.is_protected && (
                    <span className="px-2 py-1 text-xs bg-red-500/20 text-red-400 rounded-full">
                      Protected
                    </span>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {/* Actions */}
                <div className="flex items-center justify-between pt-2 border-t border-slate-700">
                  <Button
                    onClick={() =>
                      navigate(
                        `/applications/${projectNameId}?env=${envType.id}&selected=${envType.id}`
                      )
                    }
                    variant="ghost"
                    size="sm"
                    className="text-slate-400 hover:text-white hover:bg-slate-700"
                  >
                    <Settings className="w-4 h-4 mr-2" />
                    View Variables
                  </Button>
                  <div className="flex items-center space-x-1">
                    <Button
                      onClick={() => openEditDialog(envType)}
                      variant="ghost"
                      size="sm"
                      className="text-slate-400 hover:text-white hover:bg-slate-700"
                    >
                      <Edit3 className="w-4 h-4" />
                    </Button>
                    <Button
                      onClick={() => openDeleteDialog(envType)}
                      variant="ghost"
                      size="sm"
                      className="text-slate-400 hover:text-red-400 hover:bg-red-900/20"
                      disabled={envType.is_protected}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}

        {/* Empty State */}
        {environmentTypes.length === 0 && (
          <div className="col-span-full">
            <Card className="bg-slate-800 border-slate-700 border-dashed">
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Settings className="w-12 h-12 text-slate-600 mb-4" />
                <h3 className="text-lg font-medium text-white mb-2">
                  No Environment Types
                </h3>
                <p className="text-slate-400 text-center mb-6 max-w-md">
                  Create your first environment type to start organizing your
                  environment variables. Common types include Development,
                  Staging, and Production.
                </p>
                <Button
                  onClick={openCreateDialog}
                  className="bg-emerald-500 hover:bg-emerald-600 text-white"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Create Environment Type
                </Button>
              </CardContent>
            </Card>
          </div>
        )}
      </div>

      {/* Create Environment Type Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="bg-slate-800 border-slate-700 max-w-2xl">
          <DialogHeader>
            <DialogTitle className="text-white">
              Create Environment Type
            </DialogTitle>
            <DialogDescription className="text-slate-400">
              Add a new environment type to organize your environment variables.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6">
            {/* Environment Name */}
            <div className="space-y-2">
              <Label htmlFor="create-env-name" className="text-white">
                Environment Name *
              </Label>
              <Input
                id="create-env-name"
                value={formData.name}
                onChange={(e) => handleInputChange("name", e.target.value)}
                className={`bg-slate-900 border-slate-700 text-white ${formErrors.name ? "border-red-500" : ""
                  }`}
                placeholder="e.g., Production, Staging, Development"
                disabled={createEnvironmentType.isPending}
                maxLength={MAX_NAME_LENGTH}
              />
              {formErrors.name && (
                <p className="text-red-400 text-sm">{formErrors.name}</p>
              )}
              <div className="flex justify-between text-xs text-slate-400">
                <span>Used to identify this environment type</span>
                <span>
                  {formData.name.length}/{MAX_NAME_LENGTH}
                </span>
              </div>
            </div>

            {/* Environment Color */}
            <div className="space-y-2">
              <Label className="text-white flex items-center">
                <Palette className="w-4 h-4 mr-2" />
                Environment Color
              </Label>
              <div className="space-y-3">
                {/* Color Presets */}
                <div className="flex flex-wrap gap-2">
                  {PRESET_COLORS.map((color) => (
                    <button
                      key={color}
                      type="button"
                      onClick={() => handleInputChange("color", color)}
                      className={`w-8 h-8 rounded-full border-2 transition-all ${formData.color === color
                          ? "border-white scale-110"
                          : "border-slate-600 hover:border-slate-400"
                        }`}
                      style={{ backgroundColor: color }}
                      disabled={createEnvironmentType.isPending}
                    />
                  ))}
                </div>

                {/* Custom Color Input */}
                <div className="flex items-center space-x-3">
                  <Input
                    type="color"
                    value={formData.color}
                    onChange={(e) => handleInputChange("color", e.target.value)}
                    className="w-16 h-10 bg-slate-900 border-slate-700 cursor-pointer"
                    disabled={createEnvironmentType.isPending}
                  />
                  <Input
                    type="text"
                    value={formData.color}
                    onChange={(e) => handleInputChange("color", e.target.value)}
                    className="bg-slate-900 border-slate-700 text-white font-mono"
                    placeholder="#6366f1"
                    disabled={createEnvironmentType.isPending}
                  />
                </div>
              </div>
              {formErrors.color && (
                <p className="text-red-400 text-sm">{formErrors.color}</p>
              )}
            </div>

            {/* Environment Settings */}
            <div className="space-y-4">
              <Label className="text-white">Environment Settings</Label>

              {/* Default Environment */}
              <div className="flex items-center justify-between p-3 bg-slate-900 rounded-lg">
                <div className="space-y-1">
                  <div className="text-sm font-medium text-white">Default Environment</div>
                  <div className="text-xs text-slate-400">
                    Make this the default environment for new variables
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={formData.is_default}
                  onChange={(e) => handleInputChange("is_default", e.target.checked)}
                  className="w-4 h-4 text-emerald-600 bg-slate-800 border-slate-600 rounded focus:ring-emerald-500"
                  disabled={createEnvironmentType.isPending}
                />
              </div>

              {/* Protected Environment */}
              <div className="flex items-center justify-between p-3 bg-slate-900 rounded-lg">
                <div className="space-y-1">
                  <div className="text-sm font-medium text-white">Protected Environment</div>
                  <div className="text-xs text-slate-400">
                    Prevent accidental deletion of this environment
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={formData.is_protected}
                  onChange={(e) => handleInputChange("is_protected", e.target.checked)}
                  className="w-4 h-4 text-red-600 bg-slate-800 border-slate-600 rounded focus:ring-red-500"
                  disabled={createEnvironmentType.isPending}
                />
              </div>
            </div>

            {/* Preview */}
            <div className="bg-slate-900 rounded-lg p-4 border border-slate-700">
              <h4 className="text-sm font-medium text-white mb-3">Preview</h4>
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <div
                    className="w-4 h-4 rounded-full"
                    style={{ backgroundColor: formData.color }}
                  />
                  <span className="font-medium text-white">
                    {formData.name || "Environment Name"}
                  </span>
                </div>
                <div className="flex items-center space-x-1">
                  {formData.is_default && (
                    <span className="px-2 py-1 text-xs bg-emerald-500/20 text-emerald-400 rounded-full">
                      Default
                    </span>
                  )}
                  {formData.is_protected && (
                    <span className="px-2 py-1 text-xs bg-red-500/20 text-red-400 rounded-full">
                      Protected
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowCreateDialog(false)}
              className="text-white border-slate-600 hover:bg-slate-700"
              disabled={createEnvironmentType.isPending}
            >
              Cancel
            </Button>
            <Button
              onClick={handleCreate}
              className="bg-emerald-500 hover:bg-emerald-600 text-white"
              disabled={
                createEnvironmentType.isPending || !formData.name.trim()
              }
            >
              {createEnvironmentType.isPending ? (
                <>
                  <div className="w-4 h-4 mr-2 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <Plus className="w-4 h-4 mr-2" />
                  Create Environment Type
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Environment Type Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="bg-slate-800 border-slate-700 max-w-2xl">
          <DialogHeader>
            <DialogTitle className="text-white">
              Edit Environment Type
            </DialogTitle>
            <DialogDescription className="text-slate-400">
              Update the settings for{" "}
              <strong className="text-white">
                {selectedEnvironment?.name}
              </strong>
              .
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6">
            {/* Environment Name */}
            <div className="space-y-2">
              <Label htmlFor="edit-env-name" className="text-white">
                Environment Name *
              </Label>
              <Input
                id="edit-env-name"
                value={formData.name}
                onChange={(e) => handleInputChange("name", e.target.value)}
                className={`bg-slate-900 border-slate-700 text-white ${formErrors.name ? "border-red-500" : ""
                  }`}
                placeholder="Enter environment name"
                disabled={updateEnvironmentType.isPending}
                maxLength={MAX_NAME_LENGTH}
              />
              {formErrors.name && (
                <p className="text-red-400 text-sm">{formErrors.name}</p>
              )}
              <div className="flex justify-between text-xs text-slate-400">
                <span>Used to identify this environment type</span>
                <span>
                  {formData.name.length}/{MAX_NAME_LENGTH}
                </span>
              </div>
            </div>

            {/* Environment Color */}
            <div className="space-y-2">
              <Label className="text-white flex items-center">
                <Palette className="w-4 h-4 mr-2" />
                Environment Color
              </Label>
              <div className="space-y-3">
                {/* Color Presets */}
                <div className="flex flex-wrap gap-2">
                  {PRESET_COLORS.map((color) => (
                    <button
                      key={color}
                      type="button"
                      onClick={() => handleInputChange("color", color)}
                      className={`w-8 h-8 rounded-full border-2 transition-all ${formData.color === color
                          ? "border-white scale-110"
                          : "border-slate-600 hover:border-slate-400"
                        }`}
                      style={{ backgroundColor: color }}
                      disabled={updateEnvironmentType.isPending}
                    />
                  ))}
                </div>

                {/* Custom Color Input */}
                <div className="flex items-center space-x-3">
                  <Input
                    type="color"
                    value={formData.color}
                    onChange={(e) => handleInputChange("color", e.target.value)}
                    className="w-16 h-10 bg-slate-900 border-slate-700 cursor-pointer"
                    disabled={updateEnvironmentType.isPending}
                  />
                  <Input
                    type="text"
                    value={formData.color}
                    onChange={(e) => handleInputChange("color", e.target.value)}
                    className="bg-slate-900 border-slate-700 text-white font-mono"
                    placeholder="#6366f1"
                    disabled={updateEnvironmentType.isPending}
                  />
                </div>
              </div>
              {formErrors.color && (
                <p className="text-red-400 text-sm">{formErrors.color}</p>
              )}
            </div>

            {/* Environment Settings */}
            <div className="space-y-4">
              <Label className="text-white">Environment Settings</Label>

              {/* Default Environment */}
              <div className="flex items-center justify-between p-3 bg-slate-900 rounded-lg">
                <div className="space-y-1">
                  <div className="text-sm font-medium text-white">Default Environment</div>
                  <div className="text-xs text-slate-400">
                    Make this the default environment for new variables
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={formData.is_default}
                  onChange={(e) => handleInputChange("is_default", e.target.checked)}
                  className="w-4 h-4 text-emerald-600 bg-slate-800 border-slate-600 rounded focus:ring-emerald-500"
                  disabled={updateEnvironmentType.isPending}
                />
              </div>

              {/* Protected Environment */}
              <div className="flex items-center justify-between p-3 bg-slate-900 rounded-lg">
                <div className="space-y-1">
                  <div className="text-sm font-medium text-white">Protected Environment</div>
                  <div className="text-xs text-slate-400">
                    Prevent accidental deletion of this environment
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={formData.is_protected}
                  onChange={(e) => handleInputChange("is_protected", e.target.checked)}
                  className="w-4 h-4 text-red-600 bg-slate-800 border-slate-600 rounded focus:ring-red-500"
                  disabled={updateEnvironmentType.isPending}
                />
              </div>
            </div>

            {/* Environment Stats */}
            <div className="bg-slate-900 rounded-lg p-4 border border-slate-700">
              <h4 className="text-sm font-medium text-white mb-3">
                Environment Info
              </h4>
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-1">
                  <div className="text-lg font-bold text-white">
                    {selectedEnvironment?.variable_count || 0}
                  </div>
                  <div className="text-xs text-slate-400">
                    Environment Variables
                  </div>
                </div>
              </div>
            </div>

            {/* Preview */}
            <div className="bg-slate-900 rounded-lg p-4 border border-slate-700">
              <h4 className="text-sm font-medium text-white mb-3">Preview</h4>
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <div
                    className="w-4 h-4 rounded-full"
                    style={{ backgroundColor: formData.color }}
                  />
                  <span className="font-medium text-white">
                    {formData.name || "Environment Name"}
                  </span>
                </div>
                <div className="flex items-center space-x-1">
                  {formData.is_default && (
                    <span className="px-2 py-1 text-xs bg-emerald-500/20 text-emerald-400 rounded-full">
                      Default
                    </span>
                  )}
                  {formData.is_protected && (
                    <span className="px-2 py-1 text-xs bg-red-500/20 text-red-400 rounded-full">
                      Protected
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowEditDialog(false)}
              className="text-white border-slate-600 hover:bg-slate-700"
              disabled={updateEnvironmentType.isPending}
            >
              Cancel
            </Button>
            <Button
              onClick={handleUpdate}
              className="bg-emerald-500 hover:bg-emerald-600 text-white"
              disabled={
                updateEnvironmentType.isPending || !formData.name.trim()
              }
            >
              {updateEnvironmentType.isPending ? (
                <>
                  <div className="w-4 h-4 mr-2 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Updating...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4 mr-2" />
                  Save Changes
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent className="bg-slate-800 border-slate-700">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center">
              <AlertTriangle className="w-5 h-5 text-red-500 mr-2" />
              Delete Environment Type
            </DialogTitle>
            <DialogDescription className="text-slate-400">
              This action cannot be undone. This will permanently delete the
              environment type
              <strong className="text-white">
                {" "}
                {selectedEnvironment?.name}{" "}
              </strong>
              and all its environment variables.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Protection Warning */}
            {selectedEnvironment?.is_protected && (
              <div className="bg-red-900/20 border border-red-800 rounded-lg p-4">
                <div className="flex items-start space-x-3">
                  <AlertTriangle className="w-5 h-5 text-red-400 mt-0.5 flex-shrink-0" />
                  <div className="text-sm text-red-200">
                    <p className="font-medium mb-1">
                      This environment type is protected
                    </p>
                    <p className="text-red-300">
                      Protected environment types cannot be deleted to prevent accidental data loss.
                      You must first disable protection in the edit dialog.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Deletion Warning */}
            {!selectedEnvironment?.is_protected && (
              <>
                <div className="bg-red-900/20 border border-red-800 rounded-lg p-4">
                  <div className="flex items-start space-x-3">
                    <AlertTriangle className="w-5 h-5 text-red-400 mt-0.5 flex-shrink-0" />
                    <div className="text-sm text-red-200">
                      <p className="font-medium mb-1">
                        This will permanently delete:
                      </p>
                      <ul className="list-disc list-inside space-y-1 text-red-300">
                        <li>The environment type configuration</li>
                        <li>
                          All {selectedEnvironment?.variable_count || 0} environment
                          variables in this type
                        </li>
                        <li>All deployment history for this environment type</li>
                        <li>Any integrations using this environment type</li>
                      </ul>
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="delete-confirm" className="text-white">
                    Type{" "}
                    <code className="bg-slate-700 px-1 rounded text-red-400">
                      {selectedEnvironment?.name}
                    </code>{" "}
                    to confirm:
                  </Label>
                  <Input
                    id="delete-confirm"
                    value={deleteConfirmText}
                    onChange={(e) => setDeleteConfirmText(e.target.value)}
                    className="bg-slate-900 border-slate-700 text-white"
                    placeholder="Enter environment type name"
                    disabled={deleteEnvironmentType.isPending}
                  />
                </div>
              </>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowDeleteDialog(false);
                setDeleteConfirmText("");
                setSelectedEnvironment(null);
              }}
              className="text-white border-slate-600 hover:bg-slate-700"
              disabled={deleteEnvironmentType.isPending}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={
                selectedEnvironment?.is_protected ||
                deleteConfirmText !== selectedEnvironment?.name ||
                deleteEnvironmentType.isPending
              }
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              {deleteEnvironmentType.isPending ? (
                <>
                  <div className="w-4 h-4 mr-2 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Deleting...
                </>
              ) : (
                <>
                  <Trash2 className="w-4 h-4 mr-2" />
                  Delete Environment Type
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ManageEnvironment;
