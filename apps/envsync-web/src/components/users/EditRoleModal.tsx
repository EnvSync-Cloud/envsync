import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Crown, DollarSign, Code, Shield, Eye } from "lucide-react";

interface Role {
  id: string;
  name: string;
}

interface FormErrors {
  role?: string;
}

interface EditRoleModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedUserName: string;
  selectedRoleId: string;
  setSelectedRoleId: (roleId: string) => void;
  roles: Role[];
  formErrors: FormErrors;
  isLoading: boolean;
  onSave: () => void;
  onClose: () => void;
}

export const EditRoleModal = ({
  open,
  onOpenChange,
  selectedUserName,
  selectedRoleId,
  setSelectedRoleId,
  roles,
  formErrors,
  isLoading,
  onSave,
  onClose,
}: EditRoleModalProps) => {
  const getRoleIcon = (role: string) => {
    const roleLower = role.toLowerCase();

    if (roleLower.includes("org")) {
      return <Crown className="w-3 h-3" />;
    } else if (roleLower.includes("billing")) {
      return <DollarSign className="w-3 h-3" />;
    } else if (roleLower.includes("admin")) {
      return <Crown className="w-3 h-3" />;
    } else if (
      roleLower.includes("developer") ||
      roleLower.includes("dev") ||
      roleLower.includes("engineer")
    ) {
      return <Code className="w-3 h-3" />;
    } else if (roleLower.includes("manager") || roleLower.includes("lead")) {
      return <Shield className="w-3 h-3" />;
    } else {
      return <Eye className="w-3 h-3" />;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-gray-800 border-gray-700">
        <DialogHeader>
          <DialogTitle className="text-white">Edit User Role</DialogTitle>
          <DialogDescription className="text-gray-400">
            Change the role for{" "}
            <strong className="text-white">{selectedUserName}</strong>.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="edit-role" className="text-white">
              Role *
            </Label>
            <Select
              value={selectedRoleId}
              onValueChange={setSelectedRoleId}
              disabled={isLoading}
            >
              <SelectTrigger
                className={`bg-gray-900 border-gray-700 text-white ${
                  formErrors.role ? "border-red-500" : ""
                }`}
              >
                <SelectValue placeholder="Select a role" />
              </SelectTrigger>
              <SelectContent className="bg-gray-800 border-gray-700">
                {roles.map((role) => (
                  <SelectItem
                    key={role.id}
                    value={role.id}
                    className="text-white hover:bg-gray-700"
                  >
                    <div className="flex items-center space-x-2">
                      {getRoleIcon(role.name)}
                      <span>{role.name}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {formErrors.role && (
              <p className="text-red-400 text-sm">{formErrors.role}</p>
            )}
          </div>
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={onClose}
            className="text-white border-gray-600 hover:bg-gray-700"
            disabled={isLoading}
          >
            Cancel
          </Button>
          <Button
            onClick={onSave}
            className="bg-violet-500 hover:bg-violet-600 text-white"
            disabled={isLoading}
          >
            {isLoading ? (
              <>
                <div className="w-4 h-4 mr-2 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Updating...
              </>
            ) : (
              "Save Changes"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
