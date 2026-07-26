import { useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { appDetailPath } from "@/lib/app-routes";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  ArrowLeft,
  Plus,
  FolderPlus,
  Shield,
  Key,
  Info,
  Eye,
  Database,
  Palette,
  X,
  Layers,
} from "lucide-react";
import { sdk } from "@/api";
import { toast } from "sonner";
import { trackAction } from "@/telemetry";
import { ErrorAlert } from "@/components/ui/error-alert";
import {
  TooltipTrigger,
  Tooltip,
  TooltipContent,
} from "@/components/ui/tooltip";
import { Badge } from "@/components/ui/badge";
import { ENV_TYPE_COLORS } from "@/constants";
import { createUuid } from "@/utils/uuid";

interface CreateProjectFormData {
  name: string;
  description: string;
  enableSecrets: boolean;
  publicKey: string;
}

interface CreateProjectFormErrors {
  name?: string;
  description?: string;
  publicKey?: string;
}

interface PendingEnvType {
  tempId: string;
  name: string;
  color: string;
}

const MAX_NAME_LENGTH = 100;
const MAX_DESCRIPTION_LENGTH = 500;
const MAX_PUBLIC_KEY_LENGTH = 2000;
const PROJECT_NAME_REGEX = /^[a-zA-Z0-9][a-zA-Z0-9-_\s]*[a-zA-Z0-9]$/;

const ENV_PRESETS: Omit<PendingEnvType, "tempId">[] = [
  { name: "Development", color: "#22c55e" },
  { name: "Staging", color: "#f59e0b" },
  { name: "Production", color: "#ef4444" },
];

export const CreateProject = () => {
  const navigate = useNavigate();

  // Form state
  const [formData, setFormData] = useState<CreateProjectFormData>({
    name: "",
    description: "",
    enableSecrets: false,
    publicKey: "",
  });
  const [formErrors, setFormErrors] = useState<CreateProjectFormErrors>({});

  // Environment type state
  const [pendingEnvTypes, setPendingEnvTypes] = useState<PendingEnvType[]>([]);
  const [envTypeInput, setEnvTypeInput] = useState<{
    name: string;
    color: string;
  }>({ name: "", color: ENV_TYPE_COLORS[4] });
  const [envTypeErrors, setEnvTypeErrors] = useState<{ name?: string }>({});

  // Creation progress state
  const [isCreating, setIsCreating] = useState(false);
  const [creationProgress, setCreationProgress] = useState("");
  const [submitError, setSubmitError] = useState<Error | null>(null);

  // Form validation
  const validateForm = useCallback((): boolean => {
    const errors: CreateProjectFormErrors = {};

    // Validate name
    if (!formData.name.trim()) {
      errors.name = "Project name is required";
    } else if (formData.name.trim().length < 2) {
      errors.name = "Project name must be at least 2 characters";
    } else if (formData.name.length > MAX_NAME_LENGTH) {
      errors.name = `Project name must be less than ${MAX_NAME_LENGTH} characters`;
    } else if (!PROJECT_NAME_REGEX.test(formData.name.trim())) {
      errors.name =
        "Project name can only contain letters, numbers, spaces, hyphens, and underscores";
    }

    // Validate description
    if (formData.description.length > MAX_DESCRIPTION_LENGTH) {
      errors.description = `Description must be less than ${MAX_DESCRIPTION_LENGTH} characters`;
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  }, [formData]);

  // Handle input changes
  const handleInputChange = useCallback(
    (field: keyof CreateProjectFormData, value: string | boolean) => {
      setFormData((prev) => ({ ...prev, [field]: value }));

      // Clear field error when user starts typing
      if (formErrors[field as keyof CreateProjectFormErrors]) {
        setFormErrors((prev) => ({ ...prev, [field]: undefined }));
      }

      if (submitError) {
        setSubmitError(null);
      }

      // Clear public key when secrets are disabled
      if (field === "enableSecrets" && !value) {
        setFormData((prev) => ({ ...prev, publicKey: "" }));
        setFormErrors((prev) => ({ ...prev, publicKey: undefined }));
      }
    },
    [formErrors, submitError]
  );

  // Environment type handlers
  const handleAddEnvType = useCallback(() => {
    const name = envTypeInput.name.trim();

    if (!name) {
      setEnvTypeErrors({ name: "Environment name is required" });
      return;
    }

    if (name.length < 2) {
      setEnvTypeErrors({ name: "Name must be at least 2 characters" });
      return;
    }

    if (
      pendingEnvTypes.some(
        (env) => env.name.toLowerCase() === name.toLowerCase()
      )
    ) {
      setEnvTypeErrors({ name: "Environment name already added" });
      return;
    }

    setPendingEnvTypes((prev) => [
      ...prev,
      { tempId: createUuid(), name, color: envTypeInput.color },
    ]);
    setEnvTypeInput({ name: "", color: ENV_TYPE_COLORS[Math.floor(Math.random() * ENV_TYPE_COLORS.length)] });
    setEnvTypeErrors({});
  }, [envTypeInput, pendingEnvTypes]);

  const handleRemoveEnvType = useCallback((tempId: string) => {
    setPendingEnvTypes((prev) => prev.filter((env) => env.tempId !== tempId));
  }, []);

  const handleApplyPresets = useCallback(() => {
    const existingNames = new Set(
      pendingEnvTypes.map((env) => env.name.toLowerCase())
    );
    const newPresets = ENV_PRESETS.filter(
      (preset) => !existingNames.has(preset.name.toLowerCase())
    );

    if (newPresets.length === 0) {
      toast.info("All common presets are already added");
      return;
    }

    setPendingEnvTypes((prev) => [
      ...prev,
      ...newPresets.map((preset) => ({
        ...preset,
        tempId: createUuid(),
      })),
    ]);
  }, [pendingEnvTypes]);

  // Handle form submission with sequential env type creation
  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();

      if (!validateForm() || isCreating) return;

      setIsCreating(true);
      setCreationProgress("Creating project...");

      try {
        // Step 1: Create the project
        const response = await sdk.applications.createApp({
          name: formData.name.trim(),
          description: formData.description.trim() || undefined,
          enable_secrets: formData.enableSecrets,
          public_key: formData.enableSecrets
            ? formData.publicKey.trim()
            : undefined,
        });
        trackAction("app_created", {
          "envsync.event_name": "app_created",
          "envsync.event_category": "application",
          "envsync.surface": "dashboard",
          "envsync.success": true,
          "app.id": response.id,
          "app.name": formData.name.trim(),
          "app.enable_secrets": formData.enableSecrets,
          "app.env_type_count": pendingEnvTypes.length,
        });

        // Step 2: Create environment types sequentially
        if (pendingEnvTypes.length > 0) {
          let failedCount = 0;
          for (let i = 0; i < pendingEnvTypes.length; i++) {
            const envType = pendingEnvTypes[i];
            setCreationProgress(
              `Creating environments (${i + 1}/${pendingEnvTypes.length})...`
            );
            try {
              await sdk.environmentTypes.createEnvType({
                name: envType.name,
                color: envType.color,
                app_id: response.id,
              });
            } catch (err) {
              console.error(
                `Failed to create env type "${envType.name}":`,
                err
              );
              failedCount++;
            }
          }

          if (failedCount > 0 && failedCount < pendingEnvTypes.length) {
            toast.warning(
              `Project created, but ${failedCount} environment type(s) failed to create.`
            );
          } else if (failedCount === pendingEnvTypes.length) {
            toast.warning(
              "Project created, but all environment types failed to create."
            );
          } else {
            toast.success("Project and environments created successfully!");
          }
        } else {
          toast.success("Project created successfully!");
        }

        setCreationProgress("Redirecting...");
        navigate(appDetailPath(response.id));
      } catch (error) {
        console.error("Failed to create project:", error);
        if (error instanceof Error) {
          setSubmitError(error);
        } else if (typeof error === "object" && error !== null && "issues" in error) {
          const issues = (error as { issues: { message?: string }[] }).issues;
          const msg = issues?.[0]?.message ?? "Validation failed";
          setSubmitError(new Error(msg));
        } else {
          setSubmitError(new Error("Failed to create project"));
        }
        toast.error("Failed to create project. See details below.");
      } finally {
        setIsCreating(false);
        setCreationProgress("");
      }
    },
    [formData, validateForm, isCreating, pendingEnvTypes, navigate]
  );

  // Handle back navigation
  const handleBack = useCallback(() => {
    navigate(-1);
  }, [navigate]);

  const submitLabel =
    pendingEnvTypes.length > 0
      ? `Create Project with ${pendingEnvTypes.length} Environment${pendingEnvTypes.length > 1 ? "s" : ""}`
      : "Create Project";

  return (
    <div className="space-y-6 mx-auto max-h-full">
      {/* Header */}
      <div className="flex items-center space-x-3">
        <Button
          onClick={handleBack}
          variant="ghost"
          size="sm"
          className="text-muted-foreground hover:text-foreground hover:bg-muted"
        >
          <ArrowLeft className="size-4 mr-1" />
          Back to Projects
        </Button>
      </div>
      <div className="flex items-center space-x-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Create New Project</h1>
          <p className="text-muted-foreground mt-2">
            Set up a new project to manage your variables
          </p>
        </div>
      </div>

      <div className="flex size-full justify-between gap-6">
        {/* Create Project Form */}
        <Card className="bg-card text-card-foreground border-border/80 shadow-xl rounded-xl w-3/5 h-fit">
          <CardHeader>
            <CardTitle className="text-foreground flex items-center">
              <div className="flex items-center gap-3">
                <FolderPlus className="size-8 bg-emerald-500 border border-emerald-700 p-2 stroke-[3] text-foreground rounded-md" />
                Project Details
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent className="h-fit">
            <form onSubmit={handleSubmit} className="space-y-6">
              {submitError && (
                <ErrorAlert
                  error={submitError}
                  onDismiss={() => setSubmitError(null)}
                />
              )}

              {/* Project Name */}
              <div className="space-y-2">
                <Label htmlFor="project-name" className="text-foreground">
                  Project Name *
                </Label>
                <Input
                  id="project-name"
                  value={formData.name}
                  onChange={(e) => handleInputChange("name", e.target.value)}
                  className={`bg-muted border-border text-foreground ${
                    formErrors.name ? "border-red-500" : ""
                  }`}
                  placeholder="Enter project name"
                  disabled={isCreating}
                  maxLength={MAX_NAME_LENGTH}
                />
                {formErrors.name && (
                  <p className="text-red-400 text-sm">{formErrors.name}</p>
                )}
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Use a descriptive name for your project</span>
                  <span>
                    {formData.name.length}/{MAX_NAME_LENGTH}
                  </span>
                </div>
              </div>

              {/* Project Description */}
              <div className="space-y-2">
                <Label htmlFor="project-description" className="text-foreground">
                  Description
                </Label>
                <Textarea
                  id="project-description"
                  value={formData.description}
                  onChange={(e) =>
                    handleInputChange("description", e.target.value)
                  }
                  className={`bg-muted max-h-[120px] border-border text-foreground min-h-[100px] ${
                    formErrors.description ? "border-red-500" : ""
                  }`}
                  placeholder="Describe what this project is for..."
                  disabled={isCreating}
                  maxLength={MAX_DESCRIPTION_LENGTH}
                />
                {formErrors.description && (
                  <p className="text-red-400 text-sm">
                    {formErrors.description}
                  </p>
                )}
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>
                    Optional description to help identify this project
                  </span>
                  <span>
                    {formData.description.length}/{MAX_DESCRIPTION_LENGTH}
                  </span>
                </div>
              </div>

              {/* Enable Secrets */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <Label className="text-foreground flex items-center">
                      <Shield className="w-4 h-4 mr-2 text-pink-500" />
                      Enable Secrets
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      Enable encryption for sensitive variables
                    </p>
                  </div>
                  <Switch
                    checked={formData.enableSecrets}
                    onCheckedChange={(checked) =>
                      handleInputChange("enableSecrets", checked)
                    }
                    disabled={isCreating}
                    className="data-[state=checked]:bg-emerald-500  data-[state=unchecked]:bg-muted"
                  />
                </div>
              </div>

              {/* Public Key (conditional) */}
              {formData.enableSecrets && (
                <div className="space-y-2">
                  <Label
                    htmlFor="public-key"
                    className="text-foreground flex items-center"
                  >
                    <Key className="w-4 h-4 mr-2 text-yellow-500" />
                    Public Key (Optional)
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Info className="w-4 h-4 ml-2 text-muted-foreground hover:text-muted-foreground cursor-help" />
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Leave empty for managed secrets</p>
                      </TooltipContent>
                    </Tooltip>
                  </Label>
                  <Textarea
                    id="public-key"
                    value={formData.publicKey}
                    onChange={(e) =>
                      handleInputChange("publicKey", e.target.value)
                    }
                    className={`bg-muted border-border text-foreground min-h-[120px] font-mono text-sm ${
                      formErrors.publicKey ? "border-red-500" : ""
                    }`}
                    placeholder={`-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA...
-----END PUBLIC KEY-----`}
                    disabled={isCreating}
                    maxLength={MAX_PUBLIC_KEY_LENGTH}
                  />
                  {formErrors.publicKey && (
                    <p className="text-red-400 text-sm">
                      {formErrors.publicKey}
                    </p>
                  )}
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>Paste your RSA public key for secret encryption</span>
                    <span>
                      {formData.publicKey.length}/{MAX_PUBLIC_KEY_LENGTH}
                    </span>
                  </div>
                </div>
              )}

              {/* Environment Types Section */}
              <div className="space-y-4 border-t border-border pt-6">
                <div className="flex items-center justify-between">
                  <Label className="text-foreground flex items-center">
                    <Layers className="w-4 h-4 mr-2 text-cyan-500" />
                    Environment Types
                  </Label>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleApplyPresets}
                    disabled={isCreating}
                    className="text-xs text-muted-foreground border-border hover:bg-muted hover:text-foreground"
                  >
                    <Plus className="w-3 h-3 mr-1" />
                    Add Common Presets
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Optionally define environment types (e.g. Development,
                  Staging, Production) to organize your variables.
                </p>

                {/* List of added env types */}
                {pendingEnvTypes.length > 0 && (
                  <div className="space-y-2">
                    {pendingEnvTypes.map((envType) => (
                      <div
                        key={envType.tempId}
                        className="flex items-center justify-between p-2.5 bg-muted rounded-lg border border-border"
                      >
                        <div className="flex items-center space-x-3">
                          <div
                            className="w-4 h-4 rounded-full border border-border"
                            style={{ backgroundColor: envType.color }}
                          />
                          <span className="text-sm text-foreground font-medium">
                            {envType.name}
                          </span>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => handleRemoveEnvType(envType.tempId)}
                          disabled={isCreating}
                          className="h-7 w-7 text-muted-foreground hover:text-red-400 hover:bg-muted"
                          aria-label={`Remove ${envType.name}`}
                        >
                          <X className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}

                {/* Add env type inline form */}
                <div className="space-y-3 bg-muted/50 rounded-lg p-3 border border-border">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      className="w-8 h-8 rounded-lg border-2 border-border flex items-center justify-center shrink-0"
                      style={{ backgroundColor: envTypeInput.color }}
                      title="Selected color"
                    >
                      <Palette className="w-4 h-4 text-foreground" />
                    </button>
                    <Input
                      value={envTypeInput.name}
                      onChange={(e) => {
                        setEnvTypeInput((prev) => ({
                          ...prev,
                          name: e.target.value,
                        }));
                        if (envTypeErrors.name) {
                          setEnvTypeErrors({});
                        }
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          handleAddEnvType();
                        }
                      }}
                      className="bg-muted border-border text-foreground text-sm"
                      placeholder="e.g. Development, Staging, QA..."
                      disabled={isCreating}
                    />
                    <Button
                      type="button"
                      size="sm"
                      onClick={handleAddEnvType}
                      disabled={isCreating || !envTypeInput.name.trim()}
                      className="bg-emerald-500 hover:bg-emerald-600 text-foreground shrink-0"
                    >
                      <Plus className="w-4 h-4" />
                    </Button>
                  </div>
                  {envTypeErrors.name && (
                    <p className="text-red-400 text-xs">
                      {envTypeErrors.name}
                    </p>
                  )}
                  {/* Color presets */}
                  <div className="flex flex-wrap gap-1.5">
                    {ENV_TYPE_COLORS.map((color) => (
                      <button
                        key={color}
                        type="button"
                        onClick={() =>
                          setEnvTypeInput((prev) => ({ ...prev, color }))
                        }
                        className={`w-5 h-5 rounded-full border-2 transition-all ${
                          envTypeInput.color === color
                            ? "border-white scale-110"
                            : "border-border hover:border-muted-foreground"
                        }`}
                        style={{ backgroundColor: color }}
                      />
                    ))}
                  </div>
                </div>
              </div>
            </form>
          </CardContent>
        </Card>
        {/* Project Preview */}
        <Card className="bg-card text-card-foreground border-border/80 shadow-xl rounded-xl w-2/5 h-fit">
          <CardHeader>
            <CardTitle className="text-foreground flex items-center">
              <div className="flex items-center gap-3">
                <Eye className="size-8 bg-emerald-500 border border-emerald-700 p-2 stroke-[3] text-foreground rounded-md" />
                Project Preview
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent className=" space-y-4">
            <div className="bg-muted rounded-lg p-4 border border-border">
              <div className="flex items-center space-x-3">
                <div className="size-10 bg-gradient-to-br from-emerald-500/20 to-teal-500/20 rounded-lg flex items-center justify-center">
                  <Database className="w-5 h-5 text-foreground" />
                </div>
                <div>
                  <CardTitle className="text-foreground text-lg font-semibold group-hover:text-emerald-400 transition-colors">
                    {formData.name || "Project Name"}
                  </CardTitle>
                  <div className="flex items-center space-x-2 mt-1">
                    <Badge
                      variant="secondary"
                      className="text-xs lowercase bg-yellow-500/20 text-yellow-400"
                    >
                      draft
                    </Badge>
                  </div>
                </div>
              </div>
              <div className="mt-4">
                <p className="text-muted-foreground text-sm mb-4 line-clamp-2">
                  {formData.description || "No description provided"}
                </p>
              </div>
              <div className="flex items-center space-x-2">
                <div className="flex items-center flex-wrap gap-2">
                  {/* Secrets Status Badge */}
                  {formData.enableSecrets ? (
                    <Badge
                      variant="outline"
                      className="text-xs bg-green-500/10 text-green-400 border-green-800 px-2 py-0.5 flex items-center"
                    >
                      <Shield className="w-3 h-3 mr-1" />
                      Secrets Enabled
                    </Badge>
                  ) : (
                    <Badge
                      variant="outline"
                      className="text-xs bg-muted/50 text-muted-foreground border-border px-2 py-0.5 flex items-center"
                    >
                      <Shield className="w-3 h-3 mr-1" />
                      Secrets Disabled
                    </Badge>
                  )}

                  {/* Managed/Custom Secrets Badge (only shown when secrets are enabled) */}
                  {formData.enableSecrets && (
                    <>
                      <Badge
                        variant="outline"
                        className={`text-xs ${
                          formData.publicKey
                            ? "bg-yellow-500/10 text-yellow-400 border-yellow-800"
                            : "bg-pink-500/10 text-pink-400 border-pink-800"
                        } px-2 py-0.5 flex items-center`}
                      >
                        <Key className="w-3 h-3 mr-1" />
                        {formData.publicKey
                          ? "Custom Encryption"
                          : "Managed Secrets"}
                      </Badge>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Info className="w-4 h-4 text-tertiary hover:text-muted-foreground cursor-help" />
                        </TooltipTrigger>
                        <TooltipContent className="max-w-[220px]">
                          <p>
                            {formData.publicKey
                              ? "Using custom public key for encryption"
                              : "Secrets will be managed by the platform"}
                          </p>
                        </TooltipContent>
                      </Tooltip>
                    </>
                  )}
                </div>
              </div>

              {/* Environment type badges preview */}
              {pendingEnvTypes.length > 0 && (
                <div className="mt-3 pt-3 border-t border-border">
                  <p className="text-xs text-tertiary mb-2">Environments</p>
                  <div className="flex items-center flex-wrap gap-1.5">
                    {pendingEnvTypes.map((envType) => (
                      <Badge
                        key={envType.tempId}
                        variant="outline"
                        className="text-xs px-2 py-0.5 flex items-center border-border"
                        style={{
                          backgroundColor: `${envType.color}15`,
                          color: envType.color,
                          borderColor: `${envType.color}40`,
                        }}
                      >
                        <div
                          className="w-2 h-2 rounded-full mr-1.5"
                          style={{ backgroundColor: envType.color }}
                        />
                        {envType.name}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <div className="bg-muted rounded-lg p-4 border border-border">
              <h4 className="text-sm font-medium text-foreground mb-3">
                What happens next?
              </h4>
              <ul className="space-y-2 list-disc list-inside text-sm text-muted-foreground">
                <li>Your project will be created and ready to use.</li>
                {pendingEnvTypes.length > 0 ? (
                  <li>
                    {pendingEnvTypes.length} environment type
                    {pendingEnvTypes.length > 1 ? "s" : ""} will be created
                    automatically.
                  </li>
                ) : (
                  <li>
                    You can start adding variables for different environments.
                  </li>
                )}
                {formData.enableSecrets && (
                  <li>
                    Secret variables will be encrypted using your public key.
                  </li>
                )}
                <li>Team members can be given access to manage the project.</li>
                <li>
                  You can integrate with your deployment pipeline using our CLI
                  or API.
                </li>
              </ul>
            </div>

            {/* Form Actions */}
            <div className="flex items-center justify-end space-x-3 pt-4 border-t border-border">
              <Button
                type="button"
                variant="outline"
                onClick={handleBack}
                className="text-foreground border-border hover:bg-muted"
                disabled={isCreating}
              >
                Cancel
              </Button>
              <Button
                type="button"
                onClick={() =>
                  handleSubmit({
                    preventDefault: () => {},
                  } as React.FormEvent<HTMLFormElement>)
                }
                className="bg-emerald-500 hover:bg-emerald-600 text-foreground"
                disabled={isCreating || !formData.name.trim()}
              >
                {isCreating ? (
                  <>
                    <div className="w-4 h-4 mr-2 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    {creationProgress}
                  </>
                ) : (
                  <>
                    <Plus className="w-4 h-4 mr-2" />
                    {submitLabel}
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default CreateProject;
