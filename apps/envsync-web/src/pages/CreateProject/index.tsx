import { useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { appDetailPath } from "@/lib/app-routes";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { ArrowLeft, Plus, X } from "lucide-react";
import { sdk } from "@/api";
import { toast } from "sonner";
import { trackAction } from "@/telemetry";
import { ErrorAlert } from "@/components/ui/error-alert";
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

    // Validate description (required by CreateAppRequest)
    if (!formData.description.trim()) {
      errors.description = "Description is required";
    } else if (formData.description.length > MAX_DESCRIPTION_LENGTH) {
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
      trackAction("app_create_started", { enable_secrets: formData.enableSecrets });

      try {
        // Step 1: Create the project
        const response = await sdk.applications.createApp({
          name: formData.name.trim(),
          description: formData.description.trim(),
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

        // The API creates a default Development environment. Skip that name
        // so an explicit Development entry does not create a duplicate.
        const extraEnvTypes = pendingEnvTypes.filter(
          (envType) => envType.name.trim().toLowerCase() !== "development"
        );

        // Step 2: Create any additional environment types sequentially
        if (extraEnvTypes.length > 0) {
          let failedCount = 0;
          for (let i = 0; i < extraEnvTypes.length; i++) {
            const envType = extraEnvTypes[i];
            setCreationProgress(
              `Creating environments (${i + 1}/${extraEnvTypes.length})...`
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

          if (failedCount > 0 && failedCount < extraEnvTypes.length) {
            toast.warning(
              `Project created with a Development environment, but ${failedCount} other environment type(s) failed to create.`
            );
          } else if (failedCount === extraEnvTypes.length) {
            toast.warning(
              "Project created with a Development environment, but the other environment types failed to create."
            );
          } else {
            toast.success("Project and environments created successfully!");
          }
        } else {
          toast.success("Project created with a Development environment.");
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

  const previewEnvironments = [
    { name: "Development", color: "#22c55e" },
    ...pendingEnvTypes.filter(
      (envType) => envType.name.trim().toLowerCase() !== "development",
    ),
  ];
  const secretsLabel = !formData.enableSecrets
    ? "Off"
    : formData.publicKey.trim()
      ? "Your public key"
      : "EnvSync key";

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <Button
        onClick={handleBack}
        variant="ghost"
        size="sm"
        className="-ml-2 text-muted-foreground hover:bg-muted hover:text-foreground"
      >
        <ArrowLeft className="mr-1 size-4" />
        Back to Projects
      </Button>

      <div>
        <h1 className="text-2xl font-semibold text-foreground">Create New Project</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Name it. A Development environment is included.
        </p>
      </div>

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_280px]">
        <form onSubmit={handleSubmit} className="space-y-5 rounded-xl border border-border bg-card p-6">
              {submitError && (
                <ErrorAlert
                  error={submitError}
                  onDismiss={() => setSubmitError(null)}
                />
              )}

              <div className="space-y-2">
                <div className="flex items-baseline justify-between">
                  <Label htmlFor="project-name" className="text-foreground">
                    Project name
                  </Label>
                  <span className="text-xs tabular-nums text-muted-foreground">
                    {formData.name.length}/{MAX_NAME_LENGTH}
                  </span>
                </div>
                <Input
                  id="project-name"
                  value={formData.name}
                  onChange={(e) => handleInputChange("name", e.target.value)}
                  className={`border-border bg-muted text-foreground ${
                    formErrors.name ? "border-red-500" : ""
                  }`}
                  placeholder="Billing API"
                  disabled={isCreating}
                  maxLength={MAX_NAME_LENGTH}
                />
                {formErrors.name && (
                  <p className="text-sm text-red-400">{formErrors.name}</p>
                )}
              </div>

              <div className="space-y-2">
                <div className="flex items-baseline justify-between">
                  <Label htmlFor="project-description" className="text-foreground">
                    Description
                  </Label>
                  <span className="text-xs tabular-nums text-muted-foreground">
                    {formData.description.length}/{MAX_DESCRIPTION_LENGTH}
                  </span>
                </div>
                <Textarea
                  id="project-description"
                  value={formData.description}
                  onChange={(e) =>
                    handleInputChange("description", e.target.value)
                  }
                  rows={2}
                  className={`min-h-0 border-border bg-muted text-foreground ${
                    formErrors.description ? "border-red-500" : ""
                  }`}
                  placeholder="What this project stores"
                  disabled={isCreating}
                  maxLength={MAX_DESCRIPTION_LENGTH}
                />
                {formErrors.description && (
                  <p className="text-sm text-red-400">
                    {formErrors.description}
                  </p>
                )}
              </div>

              <div className="flex items-center justify-between gap-4 rounded-lg border border-border px-4 py-3">
                <div>
                  <Label className="text-foreground">Secrets</Label>
                  <p className="text-xs text-muted-foreground">
                    EnvSync holds the key unless you paste your own.
                  </p>
                </div>
                <Switch
                  checked={formData.enableSecrets}
                  onCheckedChange={(checked) =>
                    handleInputChange("enableSecrets", checked)
                  }
                  disabled={isCreating}
                  aria-label="Enable Secrets"
                />
              </div>

              {formData.enableSecrets && (
                <div className="space-y-2">
                  <div className="flex items-baseline justify-between">
                    <Label htmlFor="public-key" className="text-foreground">
                      Your public key
                    </Label>
                    <span className="text-xs tabular-nums text-muted-foreground">
                      Optional
                    </span>
                  </div>
                  <Textarea
                    id="public-key"
                    value={formData.publicKey}
                    onChange={(e) =>
                      handleInputChange("publicKey", e.target.value)
                    }
                    rows={3}
                    className={`min-h-0 border-border bg-muted font-mono text-sm text-foreground ${
                      formErrors.publicKey ? "border-red-500" : ""
                    }`}
                    placeholder="Paste a PEM public key to hold it yourself"
                    disabled={isCreating}
                    maxLength={MAX_PUBLIC_KEY_LENGTH}
                  />
                  {formErrors.publicKey && (
                    <p className="text-sm text-red-400">
                      {formErrors.publicKey}
                    </p>
                  )}
                </div>
              )}

              <div className="space-y-3 border-t border-border pt-5">
                <div className="flex items-center justify-between gap-3">
                  <Label className="text-foreground">Environments</Label>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleApplyPresets}
                    disabled={isCreating}
                    className="border-border text-muted-foreground hover:bg-muted hover:text-foreground"
                  >
                    <Plus className="mr-1 size-3" />
                    Add Common Presets
                  </Button>
                </div>

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
                <div className="space-y-3 rounded-lg border border-border bg-muted/40 p-3">
                  <div className="flex items-center gap-2">
                    <span
                      className="size-8 shrink-0 rounded-md border border-border"
                      style={{ backgroundColor: envTypeInput.color }}
                      aria-hidden
                    />
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
                      className="border-border bg-muted text-sm text-foreground"
                      placeholder="QA"
                      disabled={isCreating}
                      aria-label="Environment name"
                    />
                    <Button
                      type="button"
                      size="sm"
                      onClick={handleAddEnvType}
                      disabled={isCreating || !envTypeInput.name.trim()}
                      className="shrink-0 "
                      aria-label="Add environment"
                    >
                      <Plus className="size-4" />
                    </Button>
                  </div>
                  {envTypeErrors.name && (
                    <p className="text-xs text-red-400">
                      {envTypeErrors.name}
                    </p>
                  )}
                  <div className="flex flex-wrap gap-1.5">
                    {ENV_TYPE_COLORS.map((color) => (
                      <button
                        key={color}
                        type="button"
                        onClick={() =>
                          setEnvTypeInput((prev) => ({ ...prev, color }))
                        }
                        aria-label={`Color ${color}`}
                        className={`size-5 rounded-full border-2 ${
                          envTypeInput.color === color
                            ? "border-white"
                            : "border-transparent"
                        }`}
                        style={{ backgroundColor: color }}
                      />
                    ))}
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 border-t border-border pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleBack}
                  disabled={isCreating}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={isCreating || !formData.name.trim() || !formData.description.trim()}
                >
                  {isCreating ? creationProgress : "Create Project"}
                </Button>
              </div>
            </form>

            <aside className="rounded-xl border border-border bg-card p-5 lg:sticky lg:top-6">
              <p className="text-xs text-muted-foreground">Preview</p>
              <p className="mt-2 truncate text-lg font-medium text-foreground">
                {formData.name.trim() || "Untitled project"}
              </p>
              <p className="mt-1 line-clamp-3 text-sm text-muted-foreground">
                {formData.description.trim() || "No description yet."}
              </p>
              <dl className="mt-5 space-y-4 text-sm">
                <div>
                  <dt className="text-muted-foreground">Secrets</dt>
                  <dd className="mt-1 text-foreground">{secretsLabel}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Environments</dt>
                  <dd className="mt-2 flex flex-wrap gap-2">
                    {previewEnvironments.map((envType) => (
                      <span
                        key={envType.name}
                        className="inline-flex items-center gap-2 rounded-full border border-border px-2.5 py-1 text-xs text-foreground"
                      >
                        <span
                          className="size-2 rounded-full"
                          style={{ backgroundColor: envType.color }}
                        />
                        {envType.name}
                      </span>
                    ))}
                  </dd>
                </div>
              </dl>
            </aside>
      </div>
    </div>
  );
};

export default CreateProject;
