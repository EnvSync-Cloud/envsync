import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ProfilePictureUpload } from "./ProfilePictureUpload";
import type { SignInMethod } from "@/api/account.api";

interface FormData {
  firstName: string;
  lastName: string;
  email: string;
  profile_picture_url: string | null;
}

interface FormErrors {
  firstName?: string;
  lastName?: string;
  email?: string;
  profile_picture_url?: string;
}

interface ProfileInformationCardProps {
  formData: FormData;
  formErrors: FormErrors;
  hasUnsavedChanges: boolean;
  logoPreview: string | null;
  fileInputRef: React.RefObject<HTMLInputElement>;
  signInMethods: SignInMethod[];
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
  signInMethods,
  onInputChange,
  onLogoUpload,
  onLogoRemove,
  onSaveChanges,
  onResetChanges,
  isLoading,
}: ProfileInformationCardProps) => {
  return (
    <Card className="rounded-xl border-border bg-card text-card-foreground">
      <CardHeader>
        <div className="flex items-center justify-between gap-3">
          <CardTitle className="text-foreground">Personal information</CardTitle>
          {hasUnsavedChanges ? (
            <span className="text-xs text-muted-foreground">Unsaved changes</span>
          ) : null}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="first-name">First name</Label>
            <Input
              id="first-name"
              value={formData.firstName}
              onChange={(event) => onInputChange("firstName", event.target.value)}
              autoComplete="given-name"
              className={formErrors.firstName ? "border-destructive" : undefined}
            />
            {formErrors.firstName ? (
              <p className="text-sm text-destructive">{formErrors.firstName}</p>
            ) : null}
          </div>
          <div className="space-y-2">
            <Label htmlFor="last-name">Last name</Label>
            <Input
              id="last-name"
              value={formData.lastName}
              onChange={(event) => onInputChange("lastName", event.target.value)}
              autoComplete="family-name"
              className={formErrors.lastName ? "border-destructive" : undefined}
            />
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between gap-3">
            <Label htmlFor="email">Email</Label>
            <button
              type="button"
              className="text-sm text-foreground underline-offset-4 hover:underline"
              onClick={() => document.getElementById("email")?.focus()}
            >
              Change email
            </button>
          </div>
          <Input
            id="email"
            type="email"
            value={formData.email}
            onChange={(event) => onInputChange("email", event.target.value)}
            autoComplete="email"
            className={formErrors.email ? "border-destructive" : undefined}
          />
          {formErrors.email ? <p className="text-sm text-destructive">{formErrors.email}</p> : null}
        </div>

        {signInMethods.length > 0 ? (
          <div className="space-y-2">
            <p className="text-sm font-medium text-foreground">Sign-in methods</p>
            <div className="flex flex-wrap gap-2">
              {signInMethods.map((method) => (
                <span
                  key={method.id}
                  className="inline-flex items-center rounded-md border border-border bg-background px-2.5 py-1 text-sm"
                >
                  {method.name}
                </span>
              ))}
            </div>
          </div>
        ) : null}

        <ProfilePictureUpload
          logoPreview={logoPreview}
          onUpload={onLogoUpload}
          onRemove={onLogoRemove}
          fileInputRef={fileInputRef}
          error={formErrors.profile_picture_url}
          disabled={isLoading}
        />

        <div className="flex gap-2">
          <Button onClick={onSaveChanges} disabled={isLoading || !hasUnsavedChanges}>
            {isLoading ? "Saving..." : "Save"}
          </Button>
          {hasUnsavedChanges ? (
            <Button variant="outline" onClick={onResetChanges}>
              Cancel
            </Button>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
};
