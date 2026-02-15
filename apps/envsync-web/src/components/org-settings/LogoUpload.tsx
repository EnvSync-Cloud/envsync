import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Upload, X } from "lucide-react";
import { useRef } from "react";

interface LogoUploadProps {
  logoPreview: string | null;
  onLogoUpload: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onLogoRemove: () => void;
  error?: string;
  isUploading?: boolean;
}

export const LogoUpload = ({
  logoPreview,
  onLogoUpload,
  onLogoRemove,
  error,
  isUploading = false,
}: LogoUploadProps) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  return (
    <div className="space-y-2">
      <Label className="text-white">Company Logo</Label>
      <div className="flex items-center space-x-4">
        <div className="w-16 h-16 bg-gray-700 rounded-lg flex items-center justify-center overflow-hidden border-2 border-gray-600">
          {logoPreview ? (
            <img 
              src={logoPreview} 
              alt="Company Logo Preview" 
              className="w-full h-full object-cover"
            />
          ) : (
            <span className="text-gray-400 text-xs font-medium">Logo</span>
          )}
        </div>
        <div className="flex flex-col space-y-2">
          <Button 
            variant="outline" 
            className="text-white border-gray-600 hover:bg-gray-700" 
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
          >
            <Upload className="w-4 h-4 mr-2" />
            {isUploading ? "Uploading..." : "Upload Logo"}
          </Button>
          {logoPreview && (
            <Button 
              variant="ghost" 
              className="text-gray-400 hover:text-white text-sm" 
              type="button"
              onClick={onLogoRemove}
              disabled={isUploading}
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
          onChange={onLogoUpload}
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
