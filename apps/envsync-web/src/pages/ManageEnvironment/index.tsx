import { useCallback, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  ArrowLeft,
  ChevronRight,
  Layers3,
  Plus,
  Settings,
  Shield,
  Trash2,
  Edit3,
  Check,
} from "lucide-react";
import { toast } from "sonner";

import { sdk } from "@/api";
import { useAuthContext } from "@/contexts/auth";
import { appDetailPath } from "@/lib/app-routes";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

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
}

interface FormData {
  name: string;
  color: string;
  is_default: boolean;
  is_protected: boolean;
}

interface FormErrors {
  name?: string;
  color?: string;
}

const MAX_NAME_LENGTH = 50;
const ENV_NAME_REGEX = /^[a-zA-Z0-9][a-zA-Z0-9-_\s]*[a-zA-Z0-9]$/;
const PRESET_COLORS = [
  "#ef4444",
  "#f97316",
  "#eab308",
  "#22c55e",
  "#06b6d4",
  "#3b82f6",
  "#6366f1",
  "#8b5cf6",
  "#ec4899",
  "#f59e0b",
];

const INITIAL_FORM: FormData = {
  name: "",
  color: "#6366f1",
  is_default: false,
  is_protected: false,
};

export const ManageEnvironment = () => {
  const { appId } = useParams<{ appId: string }>();
  const navigate = useNavigate();
  const { isLoading: isAuthLoading, isAuthenticated } = useAuthContext();
  const queryClient = useQueryClient();

  const [selectedEnvironment, setSelectedEnvironment] =
    useState<EnvironmentType | null>(null);
  const [formData, setFormData] = useState<FormData>(INITIAL_FORM);
  const [formErrors, setFormErrors] = useState<FormErrors>({});
  const [showEditSheet, setShowEditSheet] = useState(false);
  const [showCreateSheet, setShowCreateSheet] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["project-environments/manage", appId],
    queryFn: async () => {
      const projectResponse = await sdk.applications.getApp(appId!);
      const environmentTypes = await Promise.all(
        projectResponse.env_types.map(async (envType) => {
          const variables = await sdk.environmentVariables.getEnvs({
            app_id: appId!,
            env_type_id: envType.id,
          });

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
      };

      return { project, environmentTypes };
    },
    enabled: !isAuthLoading && isAuthenticated && !!appId,
    staleTime: 30_000,
  });

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

  const handleInputChange = useCallback(
    (field: keyof FormData, value: string | boolean) => {
      setFormData((prev) => ({ ...prev, [field]: value }));
      if (typeof value === "string" && formErrors[field as keyof FormErrors]) {
        setFormErrors((prev) => ({ ...prev, [field]: undefined }));
      }
    },
    [formErrors]
  );

  const invalidateEnvironmentQueries = useCallback(async () => {
    await queryClient.invalidateQueries({
      queryKey: ["project-environments", appId],
    });
    await queryClient.invalidateQueries({
      queryKey: ["project-environments/manage", appId],
    });
    await queryClient.refetchQueries({
      queryKey: ["project-environments/manage", appId],
      type: "active",
    });
  }, [appId, queryClient]);

  const createEnvironmentType = useMutation({
    mutationFn: async (payload: FormData) =>
      sdk.environmentTypes.createEnvType({
        name: payload.name.trim(),
        color: payload.color,
        is_default: payload.is_default,
        is_protected: payload.is_protected,
        app_id: appId!,
      }),
    onSuccess: async () => {
      await invalidateEnvironmentQueries();
      setShowCreateSheet(false);
      setFormData(INITIAL_FORM);
      setFormErrors({});
      toast.success("Environment type created successfully");
    },
    onError: (mutationError) => {
      console.error("Failed to create environment type:", mutationError);
      toast.error("Failed to create environment type");
    },
  });

  const updateEnvironmentType = useMutation({
    mutationFn: async (payload: FormData) => {
      if (!selectedEnvironment) {
        throw new Error("No environment selected");
      }

      return sdk.environmentTypes.updateEnvType(selectedEnvironment.id, {
        id: selectedEnvironment.id,
        name: payload.name.trim(),
        color: payload.color,
        is_default: payload.is_default,
        is_protected: payload.is_protected,
      });
    },
    onSuccess: async () => {
      await invalidateEnvironmentQueries();
      setShowEditSheet(false);
      setSelectedEnvironment(null);
      setFormData(INITIAL_FORM);
      setFormErrors({});
      toast.success("Environment type updated successfully");
    },
    onError: (mutationError) => {
      console.error("Failed to update environment type:", mutationError);
      toast.error("Failed to update environment type");
    },
  });

  const deleteEnvironmentType = useMutation({
    mutationFn: async () => {
      if (!selectedEnvironment) {
        throw new Error("No environment selected");
      }
      return sdk.environmentTypes.deleteEnvType(selectedEnvironment.id);
    },
    onSuccess: async () => {
      await invalidateEnvironmentQueries();
      setShowDeleteDialog(false);
      setSelectedEnvironment(null);
      setDeleteConfirmText("");
      toast.success("Environment type deleted successfully");
    },
    onError: (mutationError) => {
      console.error("Failed to delete environment type:", mutationError);
      toast.error("Failed to delete environment type");
    },
  });

  const resetForm = useCallback(() => {
    setFormData(INITIAL_FORM);
    setFormErrors({});
  }, []);

  const openCreateSheet = useCallback(() => {
    resetForm();
    setShowCreateSheet(true);
  }, [resetForm]);

  const openEditSheet = useCallback((environment: EnvironmentType) => {
    setSelectedEnvironment(environment);
    setFormData({
      name: environment.name,
      color: environment.color,
      is_default: environment.is_default,
      is_protected: environment.is_protected,
    });
    setFormErrors({});
    setShowEditSheet(true);
  }, []);

  const openDeleteDialog = useCallback((environment: EnvironmentType) => {
    setSelectedEnvironment(environment);
    setDeleteConfirmText("");
    setShowDeleteDialog(true);
  }, []);

  const handleCreate = useCallback(() => {
    if (!validateForm() || createEnvironmentType.isPending) {
      return;
    }
    createEnvironmentType.mutate(formData);
  }, [createEnvironmentType, formData, validateForm]);

  const handleUpdate = useCallback(() => {
    if (!validateForm() || updateEnvironmentType.isPending) {
      return;
    }
    updateEnvironmentType.mutate(formData);
  }, [formData, updateEnvironmentType, validateForm]);

  const handleDelete = useCallback(() => {
    if (
      deleteConfirmText !== selectedEnvironment?.name ||
      deleteEnvironmentType.isPending
    ) {
      return;
    }
    deleteEnvironmentType.mutate();
  }, [
    deleteConfirmText,
    deleteEnvironmentType,
    selectedEnvironment?.name,
  ]);

  const handleBack = useCallback(() => {
    navigate(appDetailPath(appId ?? ""));
  }, [appId, navigate]);

  const closeEditSheet = useCallback(() => {
    setShowEditSheet(false);
    setSelectedEnvironment(null);
    resetForm();
  }, [resetForm]);

  const renderEnvironmentForm = (mode: "create" | "edit") => (
    <div className="space-y-6">
      <div className="space-y-2">
        <Label htmlFor={`${mode}-env-name`} className="text-foreground">
          Name
        </Label>
        <Input
          id={`${mode}-env-name`}
          value={formData.name}
          onChange={(event) => handleInputChange("name", event.target.value)}
          placeholder="e.g. Production"
          className="border-border bg-card text-foreground"
        />
        {formErrors.name && (
          <p className="text-xs text-red-400">{formErrors.name}</p>
        )}
      </div>

      <div className="space-y-3">
        <Label className="text-foreground">Color</Label>
        <div className="flex flex-wrap gap-2">
          {PRESET_COLORS.map((color) => (
            <button
              type="button"
              key={color}
              className={`size-8 rounded-lg border-2 transition-all ${
                formData.color === color
                  ? "scale-110 border-white"
                  : "border-transparent hover:scale-105"
              }`}
              style={{ backgroundColor: color }}
              onClick={() => handleInputChange("color", color)}
              aria-label={`Use ${color} as environment color`}
            />
          ))}
        </div>
        {formErrors.color && (
          <p className="text-xs text-red-400">{formErrors.color}</p>
        )}
      </div>

      <div className="space-y-4 rounded-lg border border-border p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-foreground">Default</p>
            <p className="text-xs text-tertiary">
              New workflows land here first
            </p>
          </div>
          <Switch
            checked={formData.is_default}
            onCheckedChange={(checked) =>
              handleInputChange("is_default", checked)
            }
          />
        </div>
        <div className="border-t border-border" />
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-foreground">Protected</p>
            <p className="text-xs text-tertiary">
              Changes require review before apply
            </p>
          </div>
          <Switch
            checked={formData.is_protected}
            onCheckedChange={(checked) =>
              handleInputChange("is_protected", checked)
            }
            data-testid="env-type-protected-checkbox"
          />
        </div>
      </div>
    </div>
  );

  if (isLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="flex flex-col items-center space-y-4">
          <div className="size-8 animate-spin rounded-full border-2 border-border border-t-emerald-500" />
          <p className="text-sm text-tertiary">Loading...</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="space-y-4 text-center">
          <AlertTriangle className="mx-auto h-10 w-10 text-zinc-600" />
          <div>
            <h3 className="text-lg font-medium text-foreground">
              Failed to load
            </h3>
            <p className="text-sm text-tertiary">
              Project not found or access denied.
            </p>
            <div className="mt-4 flex justify-center gap-2">
              <Button
                onClick={() => refetch()}
                size="sm"
                className="bg-emerald-600 text-foreground hover:bg-emerald-700"
              >
                Retry
              </Button>
              <Button
                onClick={handleBack}
                size="sm"
                variant="outline"
                className="border-border text-muted-foreground hover:bg-muted"
              >
                <ArrowLeft className="mr-1.5 h-3.5 w-3.5" />
                Back
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const { project, environmentTypes } = data;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-medium text-foreground">Environments</h1>
        <Button
          onClick={openCreateSheet}
          size="sm"
          className="bg-emerald-600 text-foreground hover:bg-emerald-700"
        >
          <Plus className="mr-1.5 h-4 w-4" />
          Add Environment
        </Button>
      </div>

      {/* Stats */}
      <div className="flex items-center gap-4 text-sm text-muted-foreground">
        <span><span data-testid="manage-env-stat-types">{environmentTypes.length}</span> environment{environmentTypes.length !== 1 ? 's' : ''}</span>
        <span><span data-testid="manage-env-stat-protected">{environmentTypes.filter(e => e.is_protected).length}</span> protected</span>
      </div>

      {/* Environment list */}
      <div className="border border-border rounded-xl overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="border-border hover:bg-transparent">
              <TableHead>Name</TableHead>
              <TableHead className="w-[120px]">Variables</TableHead>
              <TableHead className="w-[120px]">Policy</TableHead>
              <TableHead className="w-[120px]">Status</TableHead>
              <TableHead className="w-[120px] text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {environmentTypes.map((envType) => (
              <TableRow
                key={envType.id}
                data-testid={`env-type-card-${envType.id}`}
                className="border-border"
              >
                <TableCell>
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className="size-3 rounded-full flex-shrink-0"
                      style={{ backgroundColor: envType.color }}
                    />
                    <span className="text-sm text-foreground truncate font-medium">
                      {envType.name}
                    </span>
                  </div>
                </TableCell>

                <TableCell>
                  <span className="text-sm text-muted-foreground">
                    {envType.variable_count || 0}
                  </span>
                </TableCell>

                <TableCell>
                  {envType.is_protected ? (
                    <span className="text-xs text-amber-400">Reviewed</span>
                  ) : (
                    <span className="text-xs text-muted-foreground">Direct</span>
                  )}
                </TableCell>

                <TableCell>
                  <div className="flex items-center gap-1.5">
                    {envType.is_default && (
                      <Badge
                        variant="secondary"
                        className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20 text-[10px] px-1.5 py-0"
                      >
                        Default
                      </Badge>
                    )}
                    {envType.is_protected && (
                      <Badge
                        variant="secondary"
                        data-testid={`env-type-protected-badge-${envType.id}`}
                        className="bg-amber-500/10 text-amber-400 border-amber-500/20 text-[10px] px-1.5 py-0"
                      >
                        Protected
                      </Badge>
                    )}
                    {!envType.is_default && !envType.is_protected && (
                      <Badge
                        variant="secondary"
                        className="text-[10px] px-1.5 py-0"
                      >
                        Standard
                      </Badge>
                    )}
                  </div>
                </TableCell>

                <TableCell>
                  <div className="flex items-center justify-end gap-1">
                    <Button
                      onClick={() => openEditSheet(envType)}
                      variant="ghost"
                      size="icon"
                      data-testid={`env-type-edit-${envType.id}`}
                      className="size-7 text-muted-foreground hover:text-foreground hover:bg-muted"
                      aria-label={`Edit ${envType.name}`}
                    >
                      <Edit3 className="size-3.5" />
                    </Button>
                    <Button
                      onClick={() => {
                        setSelectedEnvironment(envType);
                        setShowDeleteDialog(true);
                      }}
                      variant="ghost"
                      size="icon"
                      data-testid={`env-type-delete-${envType.id}`}
                      className="size-7 text-muted-foreground hover:text-red-400 hover:bg-red-500/10"
                      aria-label={`Delete ${envType.name}`}
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                    <Button
                      onClick={() => navigate(`${appDetailPath(appId ?? "")}?env=${envType.id}&selected=${envType.id}`)}
                      variant="ghost"
                      size="icon"
                      className="size-7 text-muted-foreground hover:text-foreground hover:bg-muted"
                      aria-label={`Go to ${envType.name}`}
                    >
                      <ChevronRight className="size-3.5" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}

            {environmentTypes.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-12">
                  <Layers3 className="mx-auto h-8 w-8 text-muted-foreground mb-3" />
                  <p className="text-sm text-muted-foreground">No environments yet</p>
                  <Button
                    onClick={openCreateSheet}
                    size="sm"
                    variant="outline"
                    className="mt-4"
                  >
                    <Plus className="mr-1.5 h-3.5 w-3.5" />
                    Create your first environment
                  </Button>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Create Sheet */}
      <Sheet open={showCreateSheet} onOpenChange={setShowCreateSheet}>
        <SheetContent
          side="right"
          className="w-full border-border bg-card sm:max-w-md"
        >
          <SheetHeader>
            <SheetTitle className="text-foreground">
              Add Environment
            </SheetTitle>
            <SheetDescription className="text-tertiary">
              Create a new environment lane for {project.name}.
            </SheetDescription>
          </SheetHeader>
          <div className="mt-6">{renderEnvironmentForm("create")}</div>
          <SheetFooter className="mt-8">
            <Button
              onClick={() => setShowCreateSheet(false)}
              variant="outline"
              className="border-border text-muted-foreground hover:bg-muted"
            >
              Cancel
            </Button>
            <Button
              onClick={handleCreate}
              disabled={createEnvironmentType.isPending}
              className="bg-emerald-600 text-foreground hover:bg-emerald-700"
            >
              {createEnvironmentType.isPending ? "Creating..." : "Create"}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      {/* Edit Sheet */}
      <Sheet open={showEditSheet} onOpenChange={setShowEditSheet}>
        <SheetContent
          side="right"
          className="w-full border-border bg-card sm:max-w-md"
        >
          <SheetHeader>
            <SheetTitle className="text-foreground">Edit Environment</SheetTitle>
            <SheetDescription className="text-tertiary">
              Update {selectedEnvironment?.name} settings.
            </SheetDescription>
          </SheetHeader>
          <div className="mt-6">{renderEnvironmentForm("edit")}</div>
          <SheetFooter className="mt-8">
            <Button
              onClick={closeEditSheet}
              variant="outline"
              className="border-border text-muted-foreground hover:bg-muted"
            >
              Cancel
            </Button>
            <Button
              onClick={handleUpdate}
              disabled={updateEnvironmentType.isPending}
              className="bg-emerald-600 text-foreground hover:bg-emerald-700"
            >
              {updateEnvironmentType.isPending ? "Saving..." : "Save"}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      {/* Delete Dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent className="border-border bg-card">
          <DialogHeader>
            <DialogTitle className="text-foreground">
              Delete Environment
            </DialogTitle>
            <DialogDescription className="text-tertiary">
              Type <span className="text-muted-foreground font-medium">{selectedEnvironment?.name}</span> to confirm.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="rounded-lg border border-red-500/20 bg-red-500/5 p-3 text-sm text-red-300">
              This will remove all variables in this environment.
            </div>
            <Input
              id="delete-confirm-text"
              value={deleteConfirmText}
              onChange={(event) => setDeleteConfirmText(event.target.value)}
              placeholder={selectedEnvironment?.name}
              className="border-border bg-card text-foreground"
            />
          </div>
          <DialogFooter>
            <Button
              onClick={() => setShowDeleteDialog(false)}
              variant="outline"
              className="border-border text-muted-foreground hover:bg-muted"
            >
              Cancel
            </Button>
            <Button
              onClick={handleDelete}
              disabled={
                deleteConfirmText !== selectedEnvironment?.name ||
                deleteEnvironmentType.isPending
              }
              className="bg-red-600 text-foreground hover:bg-red-700"
            >
              {deleteEnvironmentType.isPending ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ManageEnvironment;
