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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Database, Save, X } from "lucide-react";
import { App } from "@/constants";

interface EditAppFormData {
  name: string;
  description: string;
  status: string;
}

interface EditAppFormErrors {
  name?: string;
  description?: string;
}

interface EditAppModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  app: App | null;
  onSave: (appId: string, data: Partial<EditAppFormData>) => void;
  isSaving: boolean;
}

const INITIAL_FORM_DATA: EditAppFormData = {
  name: "",
  description: "",
  status: "active",
};

const INITIAL_FORM_ERRORS: EditAppFormErrors = {};

const STATUS_OPTIONS = [
  { value: "active", label: "Active" },
  { value: "inactive", label: "Inactive" },
];

export const EditAppModal = ({
  open,
  onOpenChange,
  app,
  onSave,
  isSaving,
}: EditAppModalProps) => {
  const [formData, setFormData] = useState<EditAppFormData>(INITIAL_FORM_DATA);
  const [formErrors, setFormErrors] =
    useState<EditAppFormErrors>(INITIAL_FORM_ERRORS);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  // Initialize form data when app changes
  useEffect(() => {
    if (app && open) {
      const initialData: EditAppFormData = {
        name: app.name || "",
        description: app.description || "",
        status: app.status || "active",
      };
      setFormData(initialData);
      setFormErrors(INITIAL_FORM_ERRORS);
      setHasUnsavedChanges(false);
    }
  }, [app, open]);

  // Form validation
  const validateForm = useCallback((): boolean => {
    const errors: EditAppFormErrors = {};

    if (!formData.name.trim()) {
      errors.name = "Project name is required";
    } else if (formData.name.trim().length < 2) {
      errors.name = "Project name must be at least 2 characters";
    } else if (formData.name.trim().length > 100) {
      errors.name = "Project name must be less than 100 characters";
    }

    if (formData.description && formData.description.length > 500) {
      errors.description = "Description must be less than 500 characters";
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  }, [formData]);

  // Handle form input changes
  const handleInputChange = useCallback(
    (field: keyof EditAppFormData, value: string) => {
      setFormData((prev) => ({ ...prev, [field]: value }));
      setHasUnsavedChanges(true);

      // Clear field error when user starts typing
      if (formErrors[field]) {
        setFormErrors((prev) => ({ ...prev, [field]: undefined }));
      }
    },
    [formErrors]
  );

  // Handle form submission
  const handleSave = useCallback(() => {
    if (!app || !validateForm() || isSaving) return;

    const updateData = {
      name: formData.name.trim(),
      description: formData.description.trim(),
      status: formData.status,
    };

    onSave(app.id, updateData);
  }, [app, formData, validateForm, isSaving, onSave]);

  // Handle modal close
  const handleClose = useCallback(() => {
    if (hasUnsavedChanges && !isSaving) {
      const confirmClose = window.confirm(
        "You have unsaved changes. Are you sure you want to close?"
      );
      if (!confirmClose) return;
    }

    onOpenChange(false);
    setFormData(INITIAL_FORM_DATA);
    setFormErrors(INITIAL_FORM_ERRORS);
    setHasUnsavedChanges(false);
  }, [hasUnsavedChanges, isSaving, onOpenChange]);

  if (!app) return null;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="bg-gray-900 border-gray-800 max-w-md">
        <DialogHeader>
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-gradient-to-br from-violet-500/20 to-indigo-500/20 rounded-lg flex items-center justify-center">
              <Database className="w-5 h-5 text-white" />
            </div>
            <div>
              <DialogTitle className="text-white">Edit Project</DialogTitle>
              <DialogDescription className="text-gray-400">
                Update project information and settings
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4">
          {/* Project Name */}
          <div className="space-y-2">
            <Label htmlFor="edit-name" className="text-white">
              Project Name *
            </Label>
            <Input
              id="edit-name"
              value={formData.name}
              onChange={(e) => handleInputChange("name", e.target.value)}
              className={`bg-gray-900 border-gray-800 text-white ${
                formErrors.name ? "border-red-500" : ""
              }`}
              placeholder="Enter project name"
              disabled={isSaving}
            />
            {formErrors.name && (
              <p className="text-red-400 text-sm">{formErrors.name}</p>
            )}
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="edit-description" className="text-white">
              Description
            </Label>
            <Textarea
              id="edit-description"
              value={formData.description}
              onChange={(e) => handleInputChange("description", e.target.value)}
              className={`bg-gray-900 border-gray-800 text-white ${
                formErrors.description ? "border-red-500" : ""
              }`}
              placeholder="Enter project description"
              rows={3}
              disabled={isSaving}
            />
            {formErrors.description && (
              <p className="text-red-400 text-sm">{formErrors.description}</p>
            )}
            <p className="text-xs text-gray-400">
              {formData.description.length}/500 characters
            </p>
          </div>

          {/* Status */}
          <div className="space-y-2">
            <Label htmlFor="edit-status" className="text-white">
              Status
            </Label>
            <Select
              value={formData.status}
              onValueChange={(value) => handleInputChange("status", value)}
              disabled={isSaving}
            >
              <SelectTrigger className="bg-gray-900 border-gray-800 text-white">
                <SelectValue placeholder="Select status" />
              </SelectTrigger>
              <SelectContent className="bg-gray-900 border-gray-800">
                {STATUS_OPTIONS.map((option) => (
                  <SelectItem
                    key={option.value}
                    value={option.value}
                    className="text-white hover:bg-gray-800"
                  >
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Unsaved Changes Indicator */}
          {hasUnsavedChanges && (
            <div className="bg-yellow-900/20 border border-yellow-800 rounded-lg p-3">
              <p className="text-yellow-400 text-sm">
                You have unsaved changes
              </p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={handleClose}
            className="text-white border-gray-700 hover:bg-gray-800"
            disabled={isSaving}
          >
            <X className="w-4 h-4 mr-2" />
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            className="bg-violet-500 hover:bg-violet-600 text-white"
            disabled={isSaving || !hasUnsavedChanges}
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
