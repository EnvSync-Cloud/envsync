import { useState, useEffect, useCallback, createElement } from "react";
import { useLocation } from "react-router-dom";
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
import { Plus, Shield, Key } from "lucide-react";
import {
  EnvVarFormData,
  EnvVarFormErrors,
  EnvironmentType,
  INITIAL_ENV_VAR_FORM,
  INITIAL_ENV_FORM_ERRORS,
  ENV_VAR_KEY_REGEX,
  MAX_KEY_LENGTH,
  MAX_VALUE_LENGTH,
} from "@/constants";

interface AddEnvVarModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  environmentTypes: EnvironmentType[];
  onSave: (data: EnvVarFormData) => void;
  isSaving: boolean;
  isSecret?: boolean; // Optional prop to force secret mode
}

export const AddEnvVarModal = ({
  open,
  onOpenChange,
  environmentTypes,
  onSave,
  isSaving,
  isSecret
}: AddEnvVarModalProps) => {
  const location = useLocation();
  
  // Determine if we're on secrets page or if forced to secret mode
  const isSecretsPage = location.pathname.includes('/secrets') || isSecret;
  
  const [formData, setFormData] = useState<EnvVarFormData>(INITIAL_ENV_VAR_FORM);
  const [formErrors, setFormErrors] = useState<EnvVarFormErrors>(
    INITIAL_ENV_FORM_ERRORS
  );

  // Reset form when modal opens/closes
  useEffect(() => {
    if (open) {
      const initialForm = {
        ...INITIAL_ENV_VAR_FORM,
        // Auto-set sensitive to true if on secrets page
        sensitive: isSecretsPage
      };
      setFormData(initialForm);
      setFormErrors(INITIAL_ENV_FORM_ERRORS);
    }
  }, [open, isSecretsPage]);

  // Form validation
  const validateForm = useCallback((): boolean => {
    const errors: EnvVarFormErrors = {};

    // Validate key
    if (!formData.key.trim()) {
      errors.key = "Variable key is required";
    } else if (!ENV_VAR_KEY_REGEX.test(formData.key)) {
      errors.key =
        "Key must start with a letter and contain only uppercase letters, numbers, and underscores";
    } else if (formData.key.length > MAX_KEY_LENGTH) {
      errors.key = `Key must be less than ${MAX_KEY_LENGTH} characters`;
    }

    // Validate value
    if (!formData.value.trim()) {
      errors.value = "Variable value is required";
    } else if (formData.value.length > MAX_VALUE_LENGTH) {
      errors.value = `Value must be less than ${MAX_VALUE_LENGTH} characters`;
    }

    // Validate environment type
    if (!formData.env_type_id) {
      errors.env_type_id = "Environment type is required";
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  }, [formData]);

  // Handle form input changes
  const handleInputChange = useCallback(
    (field: keyof EnvVarFormData, value: string | boolean) => {
      setFormData((prev) => ({ ...prev, [field]: value }));

      // Clear field error when user starts typing
      if (formErrors[field as keyof EnvVarFormErrors]) {
        setFormErrors((prev) => ({ ...prev, [field]: undefined }));
      }
    },
    [formErrors]
  );

  // Handle form submission
  const handleSave = useCallback(() => {
    if (!validateForm() || isSaving) return;

    onSave({
      ...formData,
      key: formData.key.trim().toUpperCase(),
      value: formData.value.trim(),
    });
  }, [formData, validateForm, isSaving, onSave]);

  // Handle modal close
  const handleClose = useCallback(() => {
    onOpenChange(false);
  }, [onOpenChange]);

  // Dynamic content based on context
  const modalTitle = isSecretsPage ? "Add Secret" : "Add Variable";
  const modalDescription = isSecretsPage 
    ? "Create a new secret for your project. Secrets are automatically encrypted and hidden by default."
    : "Create a new variable for your project. Variables can be regular values or sensitive secrets.";
  const buttonText = isSecretsPage ? "Add Secret" : "Add Variable";
  const buttonIcon = isSecretsPage ? Shield : Plus;
  const buttonColor = isSecretsPage 
    ? "bg-red-500 hover:bg-red-600" 
    : "bg-emerald-500 hover:bg-emerald-600";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-slate-800 border-slate-700 max-w-2xl">
        <DialogHeader>
          <DialogTitle className="text-white flex items-center">
            {isSecretsPage ? (
              <Shield className="w-5 h-5 text-red-500 mr-2" />
            ) : (
              <Plus className="w-5 h-5 text-emerald-500 mr-2" />
            )}
            {modalTitle}
          </DialogTitle>
          <DialogDescription className="text-slate-400">
            {modalDescription}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Context Banner */}
          {isSecretsPage && (
            <div className="bg-red-900/20 border border-red-800/30 rounded-lg p-4">
              <div className="flex items-start space-x-3">
                <Shield className="w-5 h-5 text-red-400 mt-0.5 flex-shrink-0" />
                <div>
                  <h4 className="text-sm font-medium text-red-400 mb-1">
                    Secret Mode
                  </h4>
                  <p className="text-xs text-red-300/80">
                    You're adding a secret. This value will be automatically marked as sensitive, 
                    encrypted, and hidden by default for security.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Environment Type Selection */}
          <div className="space-y-2">
            <Label htmlFor="env-type" className="text-white">
              Environment Type *
            </Label>
            <Select
              value={formData.env_type_id}
              onValueChange={(value) => handleInputChange("env_type_id", value)}
              disabled={isSaving}
            >
              <SelectTrigger
                className={`bg-slate-900 border-slate-700 text-white ${
                  formErrors.env_type_id ? "border-red-500" : ""
                }`}
              >
                <SelectValue placeholder="Select environment type" />
              </SelectTrigger>
              <SelectContent className="bg-slate-800 border-slate-700">
                {environmentTypes.map((envType) => (
                  <SelectItem
                    key={envType.id}
                    value={envType.id}
                    className="text-white hover:bg-slate-700"
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
          </div>

          {/* Variable Key */}
          <div className="space-y-2">
            <Label htmlFor="var-key" className="text-white">
              {isSecretsPage ? "Secret Key" : "Variable Key"} *
            </Label>
            <Input
              id="var-key"
              value={formData.key}
              onChange={(e) =>
                handleInputChange("key", e.target.value.toUpperCase())
              }
              className={`bg-slate-900 border-slate-700 text-white font-mono ${
                formErrors.key ? "border-red-500" : ""
              }`}
              placeholder={isSecretsPage ? "API_SECRET_KEY" : "DATABASE_URL"}
              disabled={isSaving}
              maxLength={MAX_KEY_LENGTH}
            />
            {formErrors.key && (
              <p className="text-red-400 text-sm">{formErrors.key}</p>
            )}
            <p className="text-xs text-slate-400">
              Must start with a letter and contain only uppercase letters,
              numbers, and underscores
            </p>
          </div>

          {/* Variable Value */}
          <div className="space-y-2">
            <Label htmlFor="var-value" className="text-white">
              {isSecretsPage ? "Secret Value" : "Variable Value"} *
            </Label>
            <div className="relative">
              <Textarea
                id="var-value"
                value={formData.value}
                onChange={(e) => handleInputChange("value", e.target.value)}
                className={`bg-slate-900 border-slate-700 text-white font-mono min-h-[100px] ${
                  formErrors.value ? "border-red-500" : ""
                } ${formData.sensitive ? "pr-12" : ""}`}
                placeholder={
                  isSecretsPage 
                    ? "Enter the secret value..." 
                    : "Enter the variable value..."
                }
                disabled={isSaving}
                maxLength={MAX_VALUE_LENGTH}
              />
              {formData.sensitive && (
                <div className="absolute top-2 right-2">
                  <Shield className="w-4 h-4 text-red-400" />
                </div>
              )}
            </div>
            {formErrors.value && (
              <p className="text-red-400 text-sm">{formErrors.value}</p>
            )}
            <div className="flex justify-between text-xs text-slate-400">
              <span>
                {formData.sensitive 
                  ? "This value will be encrypted and stored securely"
                  : "Value will be stored securely"
                }
              </span>
              <span>
                {formData.value.length}/{MAX_VALUE_LENGTH}
              </span>
            </div>
          </div>

          {/* Preview */}
          <div className="bg-slate-900 rounded-lg p-4 border border-slate-700">
            <h4 className="text-sm font-medium text-white mb-2">Preview</h4>
            <div className="space-y-2">
              <div className="flex items-center space-x-2">
                <span className="text-xs text-slate-400">Key:</span>
                <code className="text-sm font-mono text-emerald-400 bg-slate-800 px-2 py-1 rounded">
                  {formData.key || (isSecretsPage ? "SECRET_KEY" : "VARIABLE_KEY")}
                </code>
              </div>
              <div className="flex items-center space-x-2">
                <span className="text-xs text-slate-400">Value:</span>
                <code className="text-sm font-mono text-slate-300 bg-slate-800 px-2 py-1 rounded">
                  {formData.sensitive || isSecretsPage
                    ? "••••••••"
                    : formData.value || "variable_value"}
                </code>
              </div>
              <div className="flex items-center space-x-2">
                <span className="text-xs text-slate-400">Type:</span>
                <span
                  className={`text-xs px-2 py-1 rounded ${
                    formData.sensitive || isSecretsPage
                      ? "bg-red-900/20 text-red-400"
                      : "bg-slate-700 text-slate-300"
                  }`}
                >
                  {formData.sensitive || isSecretsPage ? "Secret" : "Variable"}
                </span>
              </div>
              <div className="flex items-center space-x-2">
                <span className="text-xs text-slate-400">Environment:</span>
                <span className="text-xs text-slate-300">
                  {environmentTypes.find(env => env.id === formData.env_type_id)?.name || "Select environment"}
                </span>
              </div>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={handleClose}
            className="text-white border-slate-600 hover:bg-slate-700"
            disabled={isSaving}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            className={`text-white ${buttonColor}`}
            disabled={
              isSaving ||
              !formData.key ||
              !formData.value ||
              !formData.env_type_id
            }
          >
            {isSaving ? (
              <>
                <div className="w-4 h-4 mr-2 border-2 border-white border-t-transparent rounded-full animate-spin" />
                {isSecretsPage ? "Adding Secret..." : "Adding Variable..."}
              </>
            ) : (
              <>
                {createElement(buttonIcon, { className: "w-4 h-4 mr-2" })}
                {buttonText}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
