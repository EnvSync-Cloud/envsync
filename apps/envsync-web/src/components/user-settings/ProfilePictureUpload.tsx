import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { User, Upload, X } from "lucide-react";

interface ProfilePictureUploadProps {
  logoPreview: string | null;
  onUpload: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onRemove: () => void;
  fileInputRef: React.RefObject<HTMLInputElement>;
  error?: string;
  disabled?: boolean;
}

export const ProfilePictureUpload = ({
  logoPreview,
  onUpload,
  onRemove,
  fileInputRef,
  error,
  disabled = false,
}: ProfilePictureUploadProps) => {
  return (
    <div className="space-y-2">
      <Label className="text-foreground">Profile Picture</Label>
      <div className="flex items-center space-x-4">
        <div className="w-16 h-16 bg-muted rounded-lg flex items-center justify-center overflow-hidden border-2 border-border">
          {logoPreview ? (
            <img 
              src={logoPreview} 
              alt="Profile Picture Preview" 
              className="w-full h-full object-cover"
            />
          ) : (
            <User className="w-8 h-8 text-muted-foreground" />
          )}
        </div>
        <div className="flex flex-col space-y-2">
          <Button 
            variant="outline" 
            className="text-foreground border-border hover:bg-muted" 
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={disabled}
          >
            <Upload className="w-4 h-4 mr-2" />
            Upload Picture
          </Button>
          {logoPreview && (
            <Button 
              variant="ghost" 
              className="text-muted-foreground hover:text-foreground text-sm" 
              type="button"
              onClick={onRemove}
              disabled={disabled}
            >
              <X className="w-4 h-4 mr-2" />
              Remove
            </Button>
          )}
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={onUpload}
          className="hidden"
        />
      </div>
      {error && (
        <p className="text-red-400 text-sm">{error}</p>
      )}
      <p className="text-xs text-muted-foreground">
        Recommended: Square image, max 5MB (PNG, JPG, GIF)
      </p>
    </div>
  );
};
