import { useState, useCallback, useMemo, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  ArrowLeft,
  Plus,
  Eye,
  EyeOff,
  Copy,
  Edit,
  Trash2,
  Search,
  Check,
  AlertTriangle,
  RefreshCw,
  X,
  Database,
  Upload,
  Settings,
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { useAuth } from "@/hooks/useAuth";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

interface ProjectEnvironmentsProps {
  projectNameId: string;
  onBack: () => void;
}

interface EnvironmentVariable {
  key: string;
  value: string;
  sensitive: boolean;
}

interface EnvironmentType {
  id: string;
  name: string;
  color: string;
}

interface EnvVarFormData {
  key: string;
  value: string;
  sensitive: boolean;
}

interface FormErrors {
  key?: string;
  value?: string;
}

// Constants
const ENVIRONMENT_COLORS = [
  "bg-electric_indigo-500",
  "bg-violet-500",
  "bg-veronica-500",
  "bg-magenta-500",
  "bg-electric_indigo-500",
  "bg-green-500",
  "bg-yellow-500",
] as const;

const COPY_SUCCESS_DURATION = 2000;
const DEBOUNCE_DELAY = 300;

export const ProjectEnvironments = ({
  projectNameId,
  onBack,
}: ProjectEnvironmentsProps) => {
  const navigate = useNavigate();
  const { api, user } = useAuth();
  const queryClient = useQueryClient();

  // UI State
  const [searchEnv, setSearchEnv] = useState("");
  const [selectedEnv, setSelectedEnv] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState("");
  const [showValues, setShowValues] = useState<Record<string, boolean>>({});
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  // Add to existing state declarations
  const [showBulkImportDialog, setShowBulkImportDialog] = useState(false);
  const [bulkEnvText, setBulkEnvText] = useState("");
  const [parsedEnvVars, setParsedEnvVars] = useState<EnvironmentVariable[]>([]);
  const [bulkImportErrors, setBulkImportErrors] = useState<string[]>([]);

  // Dialog States
  const [showAddEnvVarDialog, setShowAddEnvVarDialog] = useState(false);
  const [showEditEnvVarDialog, setShowEditEnvVarDialog] = useState(false);
  const [showDeleteEnvVarDialog, setShowDeleteEnvVarDialog] = useState(false);

  // Form States
  const [editingEnvVar, setEditingEnvVar] =
    useState<EnvironmentVariable | null>(null);
  const [formData, setFormData] = useState<EnvVarFormData>({
    key: "",
    value: "",
    sensitive: false,
  });
  const [formErrors, setFormErrors] = useState<FormErrors>({});

  // Loading states for individual actions
  const [actionLoadingStates, setActionLoadingStates] = useState<
    Record<string, boolean>
  >({});

  // Memoized color generator
  const getEnvironmentColor = useCallback((envName: string) => {
    const index =
      Math.abs(
        envName.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0)
      ) % ENVIRONMENT_COLORS.length;
    return ENVIRONMENT_COLORS[index];
  }, []);

  // Helper function to set loading state for individual actions
  const setActionLoading = useCallback((key: string, loading: boolean) => {
    setActionLoadingStates((prev) => ({ ...prev, [key]: loading }));
  }, []);

  // Fetch project data and environment types
  const {
    data: projectData,
    isLoading: isProjectLoading,
    error: projectError,
  } = useQuery({
    queryKey: ["project", projectNameId],
    queryFn: async () => {
      const appData = await api.applications.getApp(projectNameId);

      const environments = appData.env_types;

      return {
        project: appData,
        environments,
      };
    },
    enabled: !!projectNameId,
    staleTime: 5 * 60 * 1000, // 5 minutes
    retry: 3,
  });

  // Set initial selected environment when project data loads
  useEffect(() => {
    console.log("Project data loaded:", projectData);
    if (projectData?.environments.length > 0 && !selectedEnv) {
      setSelectedEnv(projectData.environments[0].id);
    }
  }, [projectData, selectedEnv]);

  // Fetch environment variables for selected environment
  const {
    data: envVars = [],
    isLoading: isEnvVarsLoading,
    error: envVarsError,
    refetch: refetchEnvVars,
  } = useQuery({
    queryKey: ["envVars", projectNameId, selectedEnv],
    queryFn: async () => {
      if (!selectedEnv) return [];
      const envVarsData = await api.environmentVariables.getEnvs({
        app_id: projectNameId,
        env_type_id: selectedEnv,
      });
      return envVarsData.map((envVar) => ({
        key: envVar.key,
        value: envVar.value,
        sensitive: false, // You might want to get this from the API
      }));
    },
    enabled: !!selectedEnv && !!projectNameId,
    staleTime: 2 * 60 * 1000, // 2 minutes
    retry: 2,
  });

  // Add this function after existing helper functions
  const parseEnvFile = useCallback(
    (content: string): { vars: EnvironmentVariable[]; errors: string[] } => {
      const lines = content.split("\n");
      const vars: EnvironmentVariable[] = [];
      const errors: string[] = [];

      lines.forEach((line, index) => {
        const trimmedLine = line.trim();

        // Skip empty lines and comments
        if (!trimmedLine || trimmedLine.startsWith("#")) {
          return;
        }

        // Check for valid KEY=VALUE format
        const equalIndex = trimmedLine.indexOf("=");
        if (equalIndex === -1) {
          errors.push(`Line ${index + 1}: Invalid format (missing =)`);
          return;
        }

        const key = trimmedLine.substring(0, equalIndex).trim();
        const value = trimmedLine.substring(equalIndex + 1).trim();

        // Validate key format
        if (!key || !/^[A-Z_][A-Z0-9_]*$/i.test(key)) {
          errors.push(`Line ${index + 1}: Invalid key format "${key}"`);
          return;
        }

        // Remove quotes from value if present
        let cleanValue = value;
        if (
          (value.startsWith('"') && value.endsWith('"')) ||
          (value.startsWith("'") && value.endsWith("'"))
        ) {
          cleanValue = value.slice(1, -1);
        }

        // Check for duplicates in current parsing
        if (vars.some((v) => v.key === key)) {
          errors.push(`Line ${index + 1}: Duplicate key "${key}"`);
          return;
        }

        // Check for existing keys in current env vars
        if (envVars.some((v) => v.key === key)) {
          errors.push(`Line ${index + 1}: Key "${key}" already exists`);
          return;
        }

        vars.push({
          key,
          value: cleanValue,
          sensitive: false,
        });
      });

      return { vars, errors };
    },
    [envVars]
  );

  // Form validation
  const validateForm = useCallback((): boolean => {
    const errors: FormErrors = {};

    if (!formData.key.trim()) {
      errors.key = "Key is required";
    } else if (!/^[A-Z_][A-Z0-9_]*$/i.test(formData.key)) {
      errors.key = "Key must contain only letters, numbers, and underscores";
    } else if (
      !editingEnvVar &&
      envVars.some((envVar) => envVar.key === formData.key)
    ) {
      errors.key = "Key already exists";
    }

    if (!formData.value.trim()) {
      errors.value = "Value is required";
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  }, [formData, envVars, editingEnvVar]);

  // Mutations
  const addEnvVarMutation = useMutation({
    mutationFn: async (envVar: EnvVarFormData) => {
      if (!selectedEnv) throw new Error("No environment selected");
      return api.environmentVariables.createEnv({
        app_id: projectNameId,
        env_type_id: selectedEnv,
        key: envVar.key,
        value: envVar.value,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["envVars", projectNameId, selectedEnv],
      });
      toast.success("Variable added successfully");
      resetForm();
      setShowAddEnvVarDialog(false);
    },
    onError: (error: any) => {
      const message =
        error?.response?.data?.message ||
        error.message ||
        "Failed to add variable";
      toast.error(message);
    },
  });

  const updateEnvVarMutation = useMutation({
    mutationFn: async ({ key, value }: { key: string; value: string }) => {
      if (!selectedEnv) throw new Error("No environment selected");
      setActionLoading(key, true);
      return api.environmentVariables.updateEnv(key, {
        app_id: projectNameId,
        env_type_id: selectedEnv,
        value,
      });
    },
    onSuccess: (_, { key }) => {
      queryClient.invalidateQueries({
        queryKey: ["envVars", projectNameId, selectedEnv],
      });
      toast.success("Variable updated successfully");
      resetForm();
      setShowEditEnvVarDialog(false);
      setActionLoading(key, false);
    },
    onError: (error: any, { key }) => {
      const message =
        error?.response?.data?.message ||
        error.message ||
        "Failed to update variable";
      toast.error(message);
      setActionLoading(key, false);
    },
  });

  const deleteEnvVarMutation = useMutation({
    mutationFn: async (key: string) => {
      if (!selectedEnv) throw new Error("No environment selected");
      setActionLoading(key, true);
      return api.environmentVariables.deleteEnv({
        app_id: projectNameId,
        env_type_id: selectedEnv,
        key,
      });
    },
    onSuccess: (_, key) => {
      queryClient.invalidateQueries({
        queryKey: ["envVars", projectNameId, selectedEnv],
      });
      toast.success("Variable deleted successfully");
      setShowDeleteEnvVarDialog(false);
      setEditingEnvVar(null);
      setActionLoading(key, false);
    },
    onError: (error: any, key) => {
      const message =
        error?.response?.data?.message ||
        error.message ||
        "Failed to delete variable";
      toast.error(message);
      setActionLoading(key, false);
    },
  });

  // Helper functions
  const resetForm = useCallback(() => {
    setFormData({ key: "", value: "", sensitive: false });
    setEditingEnvVar(null);
    setFormErrors({});
  }, []);

  const handleFormChange = useCallback(
    (field: keyof EnvVarFormData, value: string | boolean) => {
      setFormData((prev) => ({ ...prev, [field]: value }));
      // Clear field error when user starts typing
      if (formErrors[field as keyof FormErrors]) {
        setFormErrors((prev) => ({ ...prev, [field]: undefined }));
      }
    },
    [formErrors]
  );

  // Event handlers
  const handleAddEnvVar = useCallback(() => {
    if (!validateForm()) return;
    addEnvVarMutation.mutate(formData);
  }, [formData, validateForm, addEnvVarMutation]);

  const handleEditEnvVar = useCallback((envVar: EnvironmentVariable) => {
    setEditingEnvVar(envVar);
    setFormData({
      key: envVar.key,
      value: envVar.value,
      sensitive: envVar.sensitive,
    });
    setFormErrors({});
    setShowEditEnvVarDialog(true);
  }, []);

  const handleUpdateEnvVar = useCallback(() => {
    if (!validateForm() || !editingEnvVar) return;
    updateEnvVarMutation.mutate({
      key: editingEnvVar.key,
      value: formData.value,
    });
  }, [formData, editingEnvVar, validateForm, updateEnvVarMutation]);

  const handleDeleteEnvVar = useCallback(() => {
    if (!editingEnvVar) return;
    deleteEnvVarMutation.mutate(editingEnvVar.key);
  }, [editingEnvVar, deleteEnvVarMutation]);

  const handleCopyValue = useCallback(async (value: string, key: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopiedKey(key);
      toast.success("Value copied to clipboard!");
      setTimeout(() => setCopiedKey(null), COPY_SUCCESS_DURATION);
    } catch (error) {
      toast.error("Failed to copy value");
    }
  }, []);

  // Add these handlers after existing handlers
  const handleBulkImportTextChange = useCallback(
    (text: string) => {
      setBulkEnvText(text);

      if (text.trim()) {
        const { vars, errors } = parseEnvFile(text);
        setParsedEnvVars(vars);
        setBulkImportErrors(errors);
      } else {
        setParsedEnvVars([]);
        setBulkImportErrors([]);
      }
    },
    [parseEnvFile]
  );

  const handleBulkImport = useCallback(async () => {
    if (parsedEnvVars.length === 0) return;

    const results = await Promise.allSettled(
      parsedEnvVars.map((envVar) =>
        api.environmentVariables.createEnv({
          app_id: projectNameId,
          env_type_id: selectedEnv,
          key: envVar.key,
          value: envVar.value,
        })
      )
    );

    const successful = results.filter((r) => r.status === "fulfilled").length;
    const failed = results.filter((r) => r.status === "rejected").length;

    if (successful > 0) {
      toast.success(
        `Successfully imported ${successful} variables`
      );
      queryClient.invalidateQueries({
        queryKey: ["envVars", projectNameId, selectedEnv],
      });
    }

    if (failed > 0) {
      toast.error(`Failed to import ${failed} variables`);
    }

    setShowBulkImportDialog(false);
    setBulkEnvText("");
    setParsedEnvVars([]);
    setBulkImportErrors([]);
  }, [parsedEnvVars, api, projectNameId, selectedEnv, queryClient]);

  const handleCloseBulkImportDialog = useCallback(() => {
    setShowBulkImportDialog(false);
    setBulkEnvText("");
    setParsedEnvVars([]);
    setBulkImportErrors([]);
  }, []);

  const toggleValueVisibility = useCallback((key: string) => {
    setShowValues((prev) => ({ ...prev, [key]: !prev[key] }));
  }, []);

  const maskValue = useCallback((value: string) => {
    return "•".repeat(Math.min(value.length, 20));
  }, []);

  const handleCloseAddDialog = useCallback(() => {
    setShowAddEnvVarDialog(false);
    resetForm();
  }, [resetForm]);

  const handleCloseEditDialog = useCallback(() => {
    setShowEditEnvVarDialog(false);
    resetForm();
  }, [resetForm]);

  const handleCloseDeleteDialog = useCallback(() => {
    setShowDeleteEnvVarDialog(false);
    setEditingEnvVar(null);
  }, []);

  // Memoized computed values
  const filteredVars = useMemo(() => {
    return envVars.filter((envVar) =>
      envVar.key.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [envVars, searchQuery]);

  const filteredEnvironments = useMemo(() => {
    if (!projectData?.environments) return [];
    return projectData.environments.filter((env) =>
      env.name.toLowerCase().includes(searchEnv.toLowerCase())
    );
  }, [projectData?.environments, searchEnv]);

  const selectedEnvironment = useMemo(() => {
    return projectData?.environments.find((env) => env.id === selectedEnv);
  }, [projectData?.environments, selectedEnv]);

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center text-gray-400">Loading user data...</div>
      </div>
    );
  }

  const { can_edit } = user.role;

  // Loading states
  if (isProjectLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center space-y-4">
          <div className="size-12 border-4 border-t-electric_indigo-500 border-gray-700 rounded-full animate-spin"></div>
          <div className="text-white">Loading project...</div>
        </div>
      </div>
    );
  }

  // Error states
  if (projectError) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center space-y-4">
          <AlertTriangle className="w-12 h-12 text-red-400" />
          <div className="text-red-400 text-center">
            <h3 className="text-lg font-semibold mb-2">
              Failed to load project
            </h3>
            <p className="text-sm text-gray-400 mb-4">
              {projectError instanceof Error
                ? projectError.message
                : "Unknown error occurred"}
            </p>
            <Button
              onClick={() => window.location.reload()}
              className="bg-electric_indigo-500 hover:bg-electric_indigo-600 text-white"
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              Retry
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (!projectData) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <AlertTriangle className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-white mb-2">
            No Project Data
          </h3>
          <p className="text-gray-400 mb-4">
            Unable to load project information
          </p>
          <Button
            onClick={onBack}
            variant="outline"
            className="text-white border-gray-600 hover:bg-gray-700"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Go Back
          </Button>
        </div>
      </div>
    );
  }

  // No environment types — prompt to create one first
  if (!projectData.environments?.length) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center text-center max-w-md">
          <Settings className="w-12 h-12 text-slate-500 mb-4" />
          <h3 className="text-lg font-medium text-white mb-2">
            No Environment Types
          </h3>
          <p className="text-slate-400 mb-6">
            Create at least one environment type (e.g. Development, Staging,
            Production) before adding variables.
          </p>
          <div className="flex items-center gap-3">
            <Button
              onClick={onBack}
              variant="outline"
              className="text-white border-gray-600 hover:bg-gray-700"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back
            </Button>
            <Button
              onClick={() =>
                navigate(`/applications/${projectNameId}/manage-environments`)
              }
              className="bg-electric_indigo-500 hover:bg-electric_indigo-600 text-white"
            >
              <Settings className="w-4 h-4 mr-2" />
              Create Environment Type
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header Section */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Button
            onClick={onBack}
            variant="ghost"
            size="sm"
            className="text-gray-400 hover:text-white"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-white">
              {projectData.project.name}
            </h1>
            <p className="text-gray-400">Variables</p>
          </div>
        </div>
        {can_edit && (
          <div className="flex items-center space-x-3">
            <Button
              onClick={() => setShowBulkImportDialog(true)}
              variant="outline"
              className="text-white border-gray-600 hover:bg-gray-700"
              disabled={!selectedEnv}
            >
              <Upload className="w-4 h-4 mr-2" />
              Import .env
            </Button>
            <Button
              onClick={() => setShowAddEnvVarDialog(true)}
              className="bg-electric_indigo-500 hover:bg-electric_indigo-600 text-white"
              disabled={!selectedEnv || addEnvVarMutation.isPending}
            >
              <Plus className="w-4 h-4 mr-2" />
              Add Variable
            </Button>
          </div>
        )}
      </div>

      {/* Environment Selection and Search */}
      <Card className="bg-gray-800 border-gray-700">
        <CardContent className="p-6">
          <div className="flex flex-col sm:flex-row gap-4">
            {/* Environment Selector */}
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Environment
              </label>
              <Select value={selectedEnv} onValueChange={setSelectedEnv}>
                <SelectTrigger className="bg-gray-900 border-gray-700 text-white">
                  <SelectValue placeholder="Select environment" />
                </SelectTrigger>
                <SelectContent className="bg-gray-800 border-gray-700">
                  {filteredEnvironments.map((env) => (
                    <SelectItem
                      key={env.id}
                      value={env.id}
                      className="text-white"
                    >
                      <div className="flex items-center space-x-2">
                        <span
                          className={`w-3 h-3 rounded-full bg-[${env.color.toLocaleUpperCase()}]`}
                        />
                        <span>{env.name}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Search Variables */}
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Search Variables
              </label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <Input
                  placeholder="Search by key name..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 bg-gray-900 border-gray-700 text-white"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery("")}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-white"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Environment Variables List */}
      <Card className="bg-gray-800 border-gray-700">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-white flex items-center">
              {selectedEnvironment && (
                <div
                  className={`w-3 h-3 rounded-full ${selectedEnvironment.color} mr-2`}
                />
              )}
              {selectedEnvironment?.name || "Select Environment"} Variables
              {filteredVars.length > 0 && (
                <Badge variant="secondary" className="ml-2">
                  {filteredVars.length}
                </Badge>
              )}
            </CardTitle>
            {selectedEnv && (
              <Button
                onClick={() => refetchEnvVars()}
                variant="outline"
                size="sm"
                className="text-gray-400 border-gray-600 hover:bg-gray-700"
                disabled={isEnvVarsLoading}
              >
                <RefreshCw
                  className={`w-4 h-4 ${
                    isEnvVarsLoading ? "animate-spin" : ""
                  }`}
                />
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {/* Loading State */}
          {isEnvVarsLoading && (
            <div className="flex items-center justify-center py-8">
              <div className="flex flex-col items-center space-y-2">
                <div className="size-8 border-4 border-t-electric_indigo-500 border-gray-700 rounded-full animate-spin"></div>
                <p className="text-gray-400 text-sm">Loading variables...</p>
              </div>
            </div>
          )}

          {/* Error State */}
          {envVarsError && (
            <div className="flex items-center justify-center py-8">
              <div className="text-center">
                <AlertTriangle className="w-8 h-8 text-red-400 mx-auto mb-2" />
                <p className="text-red-400 mb-2">
                  Failed to load variables
                </p>
                <Button
                  onClick={() => refetchEnvVars()}
                  variant="outline"
                  size="sm"
                  className="text-gray-400 border-gray-600 hover:bg-gray-700"
                >
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Retry
                </Button>
              </div>
            </div>
          )}

          {/* Empty State */}
          {!isEnvVarsLoading && !envVarsError && filteredVars.length === 0 && (
            <div className="text-center py-8">
              <div className="w-16 h-16 bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-4">
                <Database className="w-8 h-8 text-gray-400" />
              </div>
              <h3 className="text-lg font-medium text-white mb-2">
                {searchQuery
                  ? "No variables found"
                  : "No variables"}
              </h3>
              <p className="text-gray-400 mb-4">
                {searchQuery
                  ? `No variables match "${searchQuery}"`
                  : selectedEnv
                  ? can_edit
                    ? "Add your first variable to get started"
                    : "No variables configured for this environment"
                  : "Select an environment to view variables"}
              </p>
              {selectedEnv && !searchQuery && can_edit && (
                <Button
                  onClick={() => setShowAddEnvVarDialog(true)}
                  className="bg-electric_indigo-500 hover:bg-electric_indigo-600 text-white"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Add Variable
                </Button>
              )}
            </div>
          )}

          {/* Variables Table */}
          {!isEnvVarsLoading && !envVarsError && filteredVars.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-700">
                    <th className="text-left py-3 px-4 text-gray-400 font-medium">
                      Key
                    </th>
                    <th className="text-left py-3 px-4 text-gray-400 font-medium">
                      Value
                    </th>
                    <th className="text-right py-3 px-4 text-gray-400 font-medium">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filteredVars.map((envVar) => (
                    <tr
                      key={envVar.key}
                      className="border-b border-gray-700 hover:bg-gray-750 transition-colors"
                    >
                      <td className="py-4 px-4">
                        <div className="flex items-center space-x-2">
                          <code className="text-sm font-mono text-gray-300 bg-gray-900 px-2 py-1 rounded">
                            {envVar.key}
                          </code>
                          {envVar.sensitive && (
                            <Badge variant="secondary" className="text-xs">
                              Sensitive
                            </Badge>
                          )}
                        </div>
                      </td>
                      <td className="py-4 px-4">
                        <div className="flex items-center space-x-2">
                          <code className="text-sm font-mono text-gray-300 bg-gray-900 px-2 py-1 rounded max-w-xs truncate">
                            {showValues[envVar.key]
                              ? envVar.value
                              : maskValue(envVar.value)}
                          </code>
                          <Button
                            onClick={() => toggleValueVisibility(envVar.key)}
                            variant="ghost"
                            size="sm"
                            className="text-gray-400 hover:text-white p-1"
                          >
                            {showValues[envVar.key] ? (
                              <EyeOff className="w-4 h-4" />
                            ) : (
                              <Eye className="w-4 h-4" />
                            )}
                          </Button>
                        </div>
                      </td>
                      <td className="py-4 px-4 text-right">
                        <div className="flex items-center justify-end space-x-2">
                          <Button
                            onClick={() =>
                              handleCopyValue(envVar.value, envVar.key)
                            }
                            variant="ghost"
                            size="sm"
                            className="text-gray-400 hover:text-white p-2"
                            title="Copy value"
                          >
                            {copiedKey === envVar.key ? (
                              <Check className="w-4 h-4 text-green-400" />
                            ) : (
                              <Copy className="w-4 h-4" />
                            )}
                          </Button>
                          <Button
                            onClick={() => handleEditEnvVar(envVar)}
                            variant="ghost"
                            size="sm"
                            className="text-gray-400 hover:text-white p-2"
                            title="Edit variable"
                            disabled={actionLoadingStates[envVar.key]}
                          >
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button
                            onClick={() => {
                              setEditingEnvVar(envVar);
                              setShowDeleteEnvVarDialog(true);
                            }}
                            variant="ghost"
                            size="sm"
                            className="text-gray-400 hover:text-red-400 p-2"
                            title="Delete variable"
                            disabled={actionLoadingStates[envVar.key]}
                          >
                            {actionLoadingStates[envVar.key] ? (
                              <div className="w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
                            ) : (
                              <Trash2 className="w-4 h-4" />
                            )}
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add Environment Variable Dialog */}
      <Dialog open={showAddEnvVarDialog} onOpenChange={setShowAddEnvVarDialog}>
        <DialogContent className="bg-gray-800 border-gray-700 max-w-md">
          <DialogHeader>
            <DialogTitle className="text-white">
              Add Variable
            </DialogTitle>
            <DialogDescription className="text-gray-400">
              Add a new variable to {selectedEnvironment?.name}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-white">Key *</label>
              <Input
                placeholder="VARIABLE_NAME"
                value={formData.key}
                onChange={(e) =>
                  handleFormChange("key", e.target.value.toUpperCase())
                }
                className={`bg-gray-900 border-gray-700 text-white ${
                  formErrors.key ? "border-red-500" : ""
                }`}
              />
              {formErrors.key && (
                <p className="text-red-400 text-sm">{formErrors.key}</p>
              )}
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-white">Value *</label>
              <Input
                placeholder="Enter value"
                value={formData.value}
                onChange={(e) => handleFormChange("value", e.target.value)}
                className={`bg-gray-900 border-gray-700 text-white ${
                  formErrors.value ? "border-red-500" : ""
                }`}
              />
              {formErrors.value && (
                <p className="text-red-400 text-sm">{formErrors.value}</p>
              )}
            </div>
            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="sensitive"
                checked={formData.sensitive}
                onChange={(e) =>
                  handleFormChange("sensitive", e.target.checked)
                }
                className="rounded border-gray-700 bg-gray-900"
              />
              <label htmlFor="sensitive" className="text-sm text-white">
                Mark as sensitive
              </label>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={handleCloseAddDialog}
              className="text-white border-gray-600 hover:bg-gray-700"
              disabled={addEnvVarMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              onClick={handleAddEnvVar}
              className="bg-electric_indigo-500 hover:bg-electric_indigo-600 text-white"
              disabled={addEnvVarMutation.isPending}
            >
              {addEnvVarMutation.isPending ? (
                <>
                  <div className="w-4 h-4 mr-2 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Adding...
                </>
              ) : (
                "Add Variable"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Environment Variable Dialog */}
      <Dialog
        open={showEditEnvVarDialog}
        onOpenChange={setShowEditEnvVarDialog}
      >
        <DialogContent className="bg-gray-800 border-gray-700 max-w-md">
          <DialogHeader>
            <DialogTitle className="text-white">
              Edit Variable
            </DialogTitle>
            <DialogDescription className="text-gray-400">
              Update the value for {editingEnvVar?.key} in{" "}
              {selectedEnvironment?.name}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-white">Key</label>
              <Input
                value={formData.key}
                disabled
                className="bg-gray-900 border-gray-700 text-gray-400 opacity-50"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-white">Value *</label>
              <Input
                placeholder="Enter value"
                value={formData.value}
                onChange={(e) => handleFormChange("value", e.target.value)}
                className={`bg-gray-900 border-gray-700 text-white ${
                  formErrors.value ? "border-red-500" : ""
                }`}
              />
              {formErrors.value && (
                <p className="text-red-400 text-sm">{formErrors.value}</p>
              )}
            </div>
            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="sensitive-edit"
                checked={formData.sensitive}
                onChange={(e) =>
                  handleFormChange("sensitive", e.target.checked)
                }
                className="rounded border-gray-700 bg-gray-900"
              />
              <label htmlFor="sensitive-edit" className="text-sm text-white">
                Mark as sensitive
              </label>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={handleCloseEditDialog}
              className="text-white border-gray-600 hover:bg-gray-700"
              disabled={updateEnvVarMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              onClick={handleUpdateEnvVar}
              className="bg-electric_indigo-500 hover:bg-electric_indigo-600 text-white"
              disabled={updateEnvVarMutation.isPending}
            >
              {updateEnvVarMutation.isPending ? (
                <>
                  <div className="w-4 h-4 mr-2 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Updating...
                </>
              ) : (
                "Update Variable"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Environment Variable Dialog */}
      <Dialog
        open={showDeleteEnvVarDialog}
        onOpenChange={setShowDeleteEnvVarDialog}
      >
        <DialogContent className="bg-gray-800 border-gray-700 max-w-md">
          <DialogHeader>
            <DialogTitle className="text-white">
              Delete Variable
            </DialogTitle>
            <DialogDescription className="text-gray-400">
              Are you sure you want to delete the variable "
              {editingEnvVar?.key}"? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="bg-red-900/20 border border-red-800 rounded-lg p-4 mt-4">
            <div className="flex items-start space-x-3">
              <AlertTriangle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
              <div>
                <h4 className="text-red-400 font-medium text-sm">Warning</h4>
                <p className="text-red-300 text-sm mt-1">
                  This will permanently remove the variable from{" "}
                  {selectedEnvironment?.name}. Any applications depending on
                  this variable may stop working.
                </p>
              </div>
            </div>
          </div>
          <DialogFooter className="mt-6">
            <Button
              variant="outline"
              onClick={handleCloseDeleteDialog}
              className="text-white border-gray-600 hover:bg-gray-700"
              disabled={deleteEnvVarMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              onClick={handleDeleteEnvVar}
              variant="destructive"
              className="bg-red-600 hover:bg-red-700 text-white"
              disabled={deleteEnvVarMutation.isPending}
            >
              {deleteEnvVarMutation.isPending ? (
                <>
                  <div className="w-4 h-4 mr-2 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Deleting...
                </>
              ) : (
                <>
                  <Trash2 className="w-4 h-4 mr-2" />
                  Delete Variable
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk Import Dialog */}
      <Dialog
        open={showBulkImportDialog}
        onOpenChange={setShowBulkImportDialog}
      >
        <DialogContent className="bg-gray-800 border-gray-700 max-w-2xl max-h-[80vh] overflow-hidden">
          <DialogHeader>
            <DialogTitle className="text-white">
              Import Variables
            </DialogTitle>
            <DialogDescription className="text-gray-400">
              Paste your .env file content below. Each line should be in
              KEY=VALUE format.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 overflow-y-auto max-h-[50vh]">
            <div className="space-y-2">
              <label className="text-sm font-medium text-white">
                .env File Content
              </label>
              <textarea
                value={bulkEnvText}
                onChange={(e) => handleBulkImportTextChange(e.target.value)}
                placeholder={`# Example:
DATABASE_URL=postgresql://localhost:5432/mydb
API_KEY=your-secret-key
DEBUG=true
PORT=3000`}
                className="w-full h-48 bg-gray-900 border-gray-700 text-white rounded-lg p-3 font-mono text-sm resize-none focus:border-electric_indigo-500 focus:ring-electric_indigo-500/20"
              />
            </div>

            {/* Parsing Results */}
            {bulkEnvText.trim() && (
              <div className="space-y-3">
                {/* Errors */}
                {bulkImportErrors.length > 0 && (
                  <div className="bg-red-900/20 border border-red-800 rounded-lg p-3">
                    <h4 className="text-red-400 font-medium text-sm mb-2">
                      Parsing Errors ({bulkImportErrors.length})
                    </h4>
                    <div className="space-y-1 max-h-24 overflow-y-auto">
                      {bulkImportErrors.map((error, index) => (
                        <p
                          key={index}
                          className="text-red-300 text-xs font-mono"
                        >
                          {error}
                        </p>
                      ))}
                    </div>
                  </div>
                )}

                {/* Successfully Parsed Variables */}
                {parsedEnvVars.length > 0 && (
                  <div className="bg-green-900/20 border border-green-800 rounded-lg p-3">
                    <h4 className="text-green-400 font-medium text-sm mb-2">
                      Ready to Import ({parsedEnvVars.length} variables)
                    </h4>
                    <div className="space-y-1 max-h-32 overflow-y-auto">
                      {parsedEnvVars.map((envVar, index) => (
                        <div
                          key={index}
                          className="flex items-center justify-between text-xs"
                        >
                          <span className="text-green-300 font-mono">
                            {envVar.key}
                          </span>
                          <span className="text-gray-400 font-mono truncate max-w-48">
                            {envVar.value.length > 30
                              ? `${envVar.value.substring(0, 30)}...`
                              : envVar.value}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={handleCloseBulkImportDialog}
              className="text-white border-gray-600 hover:bg-gray-700"
            >
              Cancel
            </Button>
            <Button
              onClick={handleBulkImport}
              className="bg-electric_indigo-500 hover:bg-electric_indigo-600 text-white"
              disabled={
                parsedEnvVars.length === 0 || bulkImportErrors.length > 0
              }
            >
              Import {parsedEnvVars.length} Variables
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
