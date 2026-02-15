import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { User } from "lucide-react";
import { ProfilePictureUpload } from "./ProfilePictureUpload";

interface FormData {
  name: string;
  email: string;
  profile_picture_url: string | null;
}

interface FormErrors {
  name?: string;
  email?: string;
  profile_picture_url?: string;
}

interface ProfileInformationCardProps {
  formData: FormData;
  formErrors: FormErrors;
  hasUnsavedChanges: boolean;
  logoPreview: string | null;
  fileInputRef: React.RefObject<HTMLInputElement>;
  onInputChange: (field: keyof FormData, value: string) => void;
  onLogoUpload: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onLogoRemove: () => void;
  onSaveChanges: () => void;
  onResetChanges: () => void;
  isLoading: boolean;
}

export const ProfileInformationCard = ({
  formData,
  formErrors,
  hasUnsavedChanges,
  logoPreview,
  fileInputRef,
  onInputChange,
  onLogoUpload,
  onLogoRemove,
  onSaveChanges,
  onResetChanges,
  isLoading,
}: ProfileInformationCardProps) => {
  return (
    <Card className="bg-gray-800 border-gray-700">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <User className="size-8 bg-electric_indigo-400 border border-electric_indigo-600 p-2 stroke-[3] text-white rounded-md" />
            <CardTitle className="text-white">Profile Information</CardTitle>
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
          <Label htmlFor="full-name" className="text-white">
            Full Name *
          </Label>
          <Input
            id="full-name"
            value={formData.name}
            onChange={(e) => onInputChange("name", e.target.value)}
            className={`bg-gray-900 border-gray-700 text-white ${
              formErrors.name ? "border-red-500" : ""
            }`}
            placeholder="Enter your full name"
          />
          {formErrors.name && (
            <p className="text-red-400 text-sm">{formErrors.name}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="email" className="text-white">
            Email Address *
          </Label>
          <Input
            id="email"
            type="email"
            value={formData.email}
            onChange={(e) => onInputChange("email", e.target.value)}
            className={`bg-gray-900 border-gray-700 text-white ${
              formErrors.email ? "border-red-500" : ""
            }`}
            placeholder="Enter your email address"
          />
          {formErrors.email && (
            <p className="text-red-400 text-sm">{formErrors.email}</p>
          )}
        </div>

        <ProfilePictureUpload
          logoPreview={logoPreview}
          onUpload={onLogoUpload}
          onRemove={onLogoRemove}
          fileInputRef={fileInputRef}
          error={formErrors.profile_picture_url}
          disabled={isLoading}
        />

        <div className="flex gap-2">
          <Button
            className="bg-electric_indigo-500 hover:bg-electric_indigo-600 text-white"
            onClick={onSaveChanges}
            disabled={isLoading || !hasUnsavedChanges}
          >
            {isLoading ? (
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
              className="border border-electric_indigo-500 bg-electric_indigo-200 hover:bg-electric_indigo-300 text-white/80"
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
