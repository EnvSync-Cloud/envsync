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
      <Label className="text-white">Profile Picture</Label>
      <div className="flex items-center space-x-4">
        <div className="w-16 h-16 bg-gray-700 rounded-lg flex items-center justify-center overflow-hidden border-2 border-gray-600">
          {logoPreview ? (
            <img 
              src={logoPreview} 
              alt="Profile Picture Preview" 
              className="w-full h-full object-cover"
            />
          ) : (
            <User className="w-8 h-8 text-gray-400" />
          )}
        </div>
        <div className="flex flex-col space-y-2">
          <Button 
            variant="outline" 
            className="text-white border-gray-600 hover:bg-gray-700" 
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
              className="text-gray-400 hover:text-white text-sm" 
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
      <p className="text-xs text-gray-400">
        Recommended: Square image, max 5MB (PNG, JPG, GIF)
      </p>
    </div>
  );
};
