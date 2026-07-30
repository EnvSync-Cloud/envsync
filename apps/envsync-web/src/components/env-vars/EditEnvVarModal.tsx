import { useState, useEffect, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Edit, Shield, Key, Save, Eye, EyeOff } from "lucide-react";
import {
  EnvVarFormData,
  EnvVarFormErrors,
  EnvironmentVariable,
  EnvironmentType,
  SingleItemEnvVarUpdateData,
  ENV_VAR_KEY_REGEX,
  MAX_KEY_LENGTH,
  MAX_VALUE_LENGTH,
  INITIAL_ENV_FORM_ERRORS,
} from "@/constants";
import { buildSingleItemEnvVarUpdate } from "@/lib/single-item-env-update";

interface EditEnvVarModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  variable: EnvironmentVariable | null;
  environmentTypes: EnvironmentType[];
  onSave: (data: SingleItemEnvVarUpdateData) => void;
  isSaving: boolean;
}

export const EditEnvVarModal = ({
  open,
  onOpenChange,
  variable,
  environmentTypes,
  onSave,
  isSaving,
}: EditEnvVarModalProps) => {
  const [formData, setFormData] = useState<EnvVarFormData>({
    key: "",
    value: "",
    sensitive: false,
    env_type_id: "",
  });
  const [formErrors, setFormErrors] = useState<EnvVarFormErrors>(
    INITIAL_ENV_FORM_ERRORS
  );
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [showSensitiveValue, setShowSensitiveValue] = useState(false);
  const [isValueModified, setIsValueModified] = useState(false);

  // Initialize form when variable changes
  useEffect(() => {
    if (variable && open) {
      const initialData = {
        key: variable.key,
        value: variable.sensitive ? "" : variable.value, // Hide sensitive values initially
        sensitive: variable.sensitive,
        env_type_id: variable.env_type_id,
      };
      setFormData(initialData);
      setFormErrors(INITIAL_ENV_FORM_ERRORS);
      setHasUnsavedChanges(false);
      setShowSensitiveValue(false);
      setIsValueModified(false);
    }
  }, [variable, open]);

  // Check for unsaved changes
  useEffect(() => {
    if (!variable) return;

    const hasChanges =
      isValueModified && formData.value.trim() !== "" && formData.value !== variable.value;

    setHasUnsavedChanges(hasChanges);
  }, [formData, variable, isValueModified]);

  // Form validation
  const validateForm = useCallback((): boolean => {
    const errors: EnvVarFormErrors = {};

    if (!variable) {
      return false;
    }

    if (!ENV_VAR_KEY_REGEX.test(variable.key)) {
      errors.key =
        "Key must start with a letter and contain only uppercase letters, numbers, and underscores";
    } else if (variable.key.length > MAX_KEY_LENGTH) {
      errors.key = `Key must be less than ${MAX_KEY_LENGTH} characters`;
    }

    if (isValueModified) {
      if (!formData.value.trim()) {
        errors.value = "Variable value is required";
      } else if (formData.value.length > MAX_VALUE_LENGTH) {
        errors.value = `Value must be less than ${MAX_VALUE_LENGTH} characters`;
      }
    }

    if (!variable.env_type_id) {
      errors.env_type_id = "Environment type is required";
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  }, [formData, variable, isValueModified]);

  // Handle form input changes
  const handleInputChange = useCallback(
    (field: keyof EnvVarFormData, value: string | boolean) => {
      setFormData((prev) => ({ ...prev, [field]: value }));

      // Track if value field was modified
      if (field === "value" && typeof value === "string") {
        setIsValueModified(true);
      }

      // Clear field error when user starts typing
      if (formErrors[field as keyof EnvVarFormErrors]) {
        setFormErrors((prev) => ({ ...prev, [field]: undefined }));
      }
    },
    [formErrors]
  );

  // Handle revealing sensitive value
  const handleRevealSensitiveValue = useCallback(() => {
    if (variable && variable.sensitive && !showSensitiveValue) {
      setShowSensitiveValue(true);
    }
  }, [variable, showSensitiveValue]);

  // Handle hiding sensitive value
  const handleHideSensitiveValue = useCallback(() => {
    if (variable && variable.sensitive && showSensitiveValue && !isValueModified) {
      setFormData((prev) => ({ ...prev, value: "" }));
      setShowSensitiveValue(false);
    }
  }, [variable, showSensitiveValue, isValueModified]);

  // Handle form submission
  const handleSave = useCallback(() => {
    if (!variable || !validateForm() || isSaving) return;

    const updateData = buildSingleItemEnvVarUpdate(
      variable,
      formData,
      isValueModified
    );
    if (!updateData) return;

    onSave(updateData);
  }, [variable, formData, validateForm, isSaving, onSave, isValueModified]);

  // Handle modal close
  const handleClose = useCallback(() => {
    onOpenChange(false);
  }, [onOpenChange]);

  if (!variable) return null;

  const isSensitiveAndHidden = variable.sensitive && !showSensitiveValue && !isValueModified;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card border-border max-w-2xl">
        <DialogHeader>
          <DialogTitle className="text-foreground flex items-center">
            <Edit className="w-5 h-5 text-emerald-500 mr-2" />
            Edit Variable
          </DialogTitle>
          <DialogDescription className="text-muted-foreground">
            Update the variable details. Changes will be applied
            immediately.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Environment Type Selection */}
          <div className="space-y-2">
            <Label htmlFor="edit-env-type" className="text-foreground">
              Environment Type *
            </Label>
            <Select
              value={formData.env_type_id}
              disabled
            >
              <SelectTrigger
                className={`bg-card border-border text-foreground ${
                  formErrors.env_type_id ? "border-red-500" : ""
                }`}
              >
                <SelectValue placeholder="Select environment type" />
              </SelectTrigger>
              <SelectContent className="bg-card border-border">
                {environmentTypes.map((envType) => (
                  <SelectItem
                    key={envType.id}
                    value={envType.id}
                    className="text-foreground hover:bg-muted"
                  >
                    <div className="flex items-center space-x-2">
                      <div
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: envType.color }}
                      />
                      <span>{envType.name}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {formErrors.env_type_id && (
              <p className="text-red-400 text-sm">{formErrors.env_type_id}</p>
            )}
            <p className="text-xs text-muted-foreground">
              Moving variables between environments is not supported from edit mode.
            </p>
          </div>

          {/* Variable Key */}
          <div className="space-y-2">
            <Label htmlFor="edit-var-key" className="text-foreground">
              Variable Key *
            </Label>
            <Input
              id="edit-var-key"
              value={formData.key}
              className={`bg-card border-border text-foreground font-mono ${
                formErrors.key ? "border-red-500" : ""
              }`}
              placeholder="DATABASE_URL"
              disabled
              maxLength={MAX_KEY_LENGTH}
            />
            {formErrors.key && (
              <p className="text-red-400 text-sm">{formErrors.key}</p>
            )}
            <p className="text-xs text-muted-foreground">
              Renaming keys is not supported from edit mode.
            </p>
          </div>

          {/* Variable Value */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="edit-var-value" className="text-foreground">
                Variable Value *
              </Label>
              {variable.sensitive && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={showSensitiveValue ? handleHideSensitiveValue : handleRevealSensitiveValue}
                  disabled={isSaving || isValueModified}
                  className="text-muted-foreground hover:text-foreground h-auto p-1"
                >
                  {showSensitiveValue ? (
                    <>
                      <EyeOff className="w-4 h-4 mr-1" />
                      Hide
                    </>
                  ) : (
                    <>
                      <Eye className="w-4 h-4 mr-1" />
                      Reveal
                    </>
                  )}
                </Button>
              )}
            </div>
            
            {isSensitiveAndHidden ? (
              <div className="bg-card border border-border rounded-md p-4 min-h-[100px] flex items-center justify-center">
                <div className="text-center">
                  <Shield className="w-8 h-8 text-red-400 mx-auto mb-2" />
                  <p className="text-muted-foreground text-sm mb-3">
                    This is a sensitive value and is hidden for security
                  </p>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleRevealSensitiveValue}
                    className="text-muted-foreground border-border hover:bg-muted"
                  >
                    <Eye className="w-4 h-4 mr-2" />
                    Click to edit
                  </Button>
                </div>
              </div>
            ) : (
              <div className="relative">
                <Textarea
                  id="edit-var-value"
                  value={formData.value}
                  onChange={(e) => handleInputChange("value", e.target.value)}
                  className={`bg-card border-border text-foreground font-mono min-h-[100px] ${
                    formErrors.value ? "border-red-500" : ""
                  } ${variable.sensitive ? "pr-12" : ""}`}
                  placeholder={
                    variable.sensitive && !isValueModified
                      ? "Enter new value to update..."
                      : "Enter the variable value..."
                  }
                  disabled={isSaving}
                  maxLength={MAX_VALUE_LENGTH}
                />
                {variable.sensitive && showSensitiveValue && (
                  <div className="absolute top-2 right-2">
                    <Shield className="w-4 h-4 text-red-400" />
                  </div>
                )}
              </div>
            )}
            
            {formErrors.value && (
              <p className="text-red-400 text-sm">{formErrors.value}</p>
            )}
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>
                {variable.sensitive 
                  ? "Sensitive values are encrypted and hidden by default"
                  : "Value will be stored securely"
                }
              </span>
              {!isSensitiveAndHidden && (
                <span>
                  {formData.value.length}/{MAX_VALUE_LENGTH}
                </span>
              )}
            </div>
          </div>

          {/* Sensitive Checkbox */}
          <div className="flex items-center space-x-3 p-4 bg-card rounded-lg border border-border">
            <Checkbox
              id="edit-sensitive"
              checked={formData.sensitive}
              disabled
              className="border-border"
            />
            <div className="flex-1">
              <Label htmlFor="edit-sensitive" className="text-foreground flex items-center">
                {formData.sensitive ? (
                  <Shield className="w-4 h-4 text-red-400 mr-2" />
                ) : (
                  <Key className="w-4 h-4 text-muted-foreground mr-2" />
                )}
                Mark as sensitive (secret)
              </Label>
              <p className="text-xs text-muted-foreground mt-1">
                Secret/variable type cannot be changed from edit mode.
              </p>
            </div>
          </div>

          {/* Changes Summary */}
          {hasUnsavedChanges && (
            <div className="bg-yellow-900/20 border border-yellow-800 rounded-lg p-4">
              <h4 className="text-sm font-medium text-yellow-400 mb-2">
                Pending Changes
              </h4>
              <div className="space-y-1 text-xs text-yellow-300">
                {isValueModified && formData.value.trim() !== "" && (
                  <div>• Value: Updated</div>
                )}
              </div>
            </div>
          )}

          {/* Current vs New Preview */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-card rounded-lg p-4 border border-border">
              <h4 className="text-sm font-medium text-muted-foreground mb-2">
                Current
              </h4>
              <div className="space-y-2">
                <div className="flex items-center space-x-2">
                  <span className="text-xs text-tertiary">Key:</span>
                  <code className="text-sm font-mono text-muted-foreground bg-muted px-2 py-1 rounded">
                    {variable.key}
                  </code>
                </div>
                <div className="flex items-center space-x-2">
                  <span className="text-xs text-tertiary">Type:</span>
                  <span
                    className={`text-xs px-2 py-1 rounded ${
                      variable.sensitive
                        ? "bg-red-900/20 text-red-400"
                        : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {variable.sensitive ? "Secret" : "Variable"}
                  </span>
                </div>
                {variable.sensitive && (
                  <div className="flex items-center space-x-2">
                    <span className="text-xs text-tertiary">Value:</span>
                    <span className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded font-mono">
                      ••••••••
                    </span>
                  </div>
                )}
              </div>
            </div>

            <div className="bg-card rounded-lg p-4 border border-border">
              <h4 className="text-sm font-medium text-foreground mb-2">New</h4>
              <div className="space-y-2">
                <div className="flex items-center space-x-2">
                  <span className="text-xs text-tertiary">Key:</span>
                  <code className="text-sm font-mono text-emerald-400 bg-muted px-2 py-1 rounded">
                    {formData.key || "VARIABLE_KEY"}
                  </code>
                </div>
                <div className="flex items-center space-x-2">
                  <span className="text-xs text-tertiary">Type:</span>
                  <span
                    className={`text-xs px-2 py-1 rounded ${
                      formData.sensitive
                        ? "bg-red-900/20 text-red-400"
                        : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {formData.sensitive ? "Secret" : "Variable"}
                  </span>
                </div>
                {isValueModified && formData.sensitive && (
                  <div className="flex items-center space-x-2">
                    <span className="text-xs text-tertiary">Value:</span>
                    <span className="text-xs text-emerald-400 bg-muted px-2 py-1 rounded font-mono">
                      Updated
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Security Notice for Sensitive Values */}
          {variable.sensitive && (
            <div className="bg-red-900/10 border border-red-800/30 rounded-lg p-4">
              <div className="flex items-start space-x-3">
                <Shield className="w-5 h-5 text-red-400 mt-0.5 flex-shrink-0" />
                <div>
                  <h4 className="text-sm font-medium text-red-400 mb-1">
                    Security Notice
                  </h4>
                  <p className="text-xs text-red-300/80">
                    This is a sensitive variable. The current value is hidden for security.
                    {!isValueModified && " Only modify if you need to update the secret value."}
                    {isValueModified && " Make sure to save your changes to update the secret."}
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={handleClose}
            className="text-foreground border-border hover:bg-muted"
            disabled={isSaving}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            className="bg-emerald-500 hover:bg-emerald-600 text-foreground"
            disabled={
              isSaving ||
              !hasUnsavedChanges ||
              !formData.key ||
              (isValueModified && !formData.value.trim()) ||
              !formData.env_type_id
            }
          >
            {isSaving ? (
              <>
                <div className="w-4 h-4 mr-2 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Saving...
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
  );
};
