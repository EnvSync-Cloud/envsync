import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Globe } from "lucide-react";
import { FormData, FormErrors } from "@/constants";
import { LogoUpload } from "./LogoUpload";

interface OrgInfoCardProps {
  formData: FormData;
  formErrors: FormErrors;
  hasUnsavedChanges: boolean;
  orgSlug?: string;
  onInputChange: (field: keyof FormData, value: string) => void;
  onLogoUpload: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onLogoRemove: () => void;
  onSaveChanges: () => void;
  onResetChanges: () => void;
  isSaving: boolean;
  logoPreview: string | null;
}

export const OrgInfoCard = ({
  formData,
  formErrors,
  hasUnsavedChanges,
  orgSlug,
  onInputChange,
  onLogoUpload,
  onLogoRemove,
  onSaveChanges,
  onResetChanges,
  isSaving,
  logoPreview,
}: OrgInfoCardProps) => {
  return (
    <Card className="bg-card text-card-foreground bg-gradient-to-br from-gray-900 to-gray-950 border-gray-800 shadow-xl">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Globe className="size-8 mr-1 bg-violet-400 border border-violet-600 p-2 stroke-[3] text-white rounded-md" />
            <CardTitle className="text-white">
              Organization Information
            </CardTitle>
          </div>
          {hasUnsavedChanges && (
            <span className="text-xs text-yellow-400 bg-yellow-400/10 px-2 py-1 rounded">
              Unsaved changes
            </span>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="org-name" className="text-white">
            Organization Name *
          </Label>
          <Input
            id="org-name"
            value={formData.name}
            onChange={(e) => onInputChange("name", e.target.value)}
            className={`bg-gray-900 border-gray-700 text-white ${
              formErrors.name ? "border-red-500" : ""
            }`}
            placeholder="Enter organization name"
          />
          {formErrors.name && (
            <p className="text-red-400 text-sm">{formErrors.name}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="slug" className="text-white">
            Slug
          </Label>
          <Input
            id="slug"
            value={orgSlug || ""}
            className="bg-gray-900 border-gray-700 text-gray-400"
            disabled
            readOnly
          />
          <p className="text-xs text-gray-400">
            Organization slug cannot be changed
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="contact-email" className="text-white">
            Contact Email
          </Label>
          <Input
            id="contact-email"
            type="email"
            value={formData.contact_email}
            onChange={(e) => onInputChange("contact_email", e.target.value)}
            className={`bg-gray-900 border-gray-700 text-white ${
              formErrors.contact_email ? "border-red-500" : ""
            }`}
            placeholder="contact@yourorg.com"
          />
          {formErrors.contact_email && (
            <p className="text-red-400 text-sm">{formErrors.contact_email}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="website" className="text-white">
            Website
          </Label>
          <Input
            id="website"
            type="url"
            value={formData.website}
            onChange={(e) => onInputChange("website", e.target.value)}
            className={`bg-gray-900 border-gray-700 text-white ${
              formErrors.website ? "border-red-500" : ""
            }`}
            placeholder="https://yourorg.com"
          />
          {formErrors.website && (
            <p className="text-red-400 text-sm">{formErrors.website}</p>
          )}
        </div>

        <LogoUpload
          logoPreview={logoPreview}
          onLogoUpload={onLogoUpload}
          onLogoRemove={onLogoRemove}
          error={formErrors.logo_url}
          isUploading={isSaving}
        />

        <div className="flex gap-2">
          <Button
            className="bg-violet-500 hover:bg-violet-600 text-white"
            onClick={onSaveChanges}
            disabled={isSaving || !hasUnsavedChanges}
          >
            {isSaving ? (
              <>
                <div className="w-4 h-4 mr-2 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Saving...
              </>
            ) : (
              "Save Changes"
            )}
          </Button>
          {hasUnsavedChanges && (
            <Button
              className="border border-violet-500 bg-violet-200 hover:bg-violet-300 text-white/80"
              onClick={onResetChanges}
            >
              Cancel Changes
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
};
