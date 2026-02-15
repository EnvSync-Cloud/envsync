import { Plus, ShieldAlert } from "lucide-react";
import { Button } from "../ui/button";
import { RoleEditForm } from "./edit-form";

export const EmptyRoles = () => (
  <div className="text-center py-12">
    <ShieldAlert className="w-16 h-16 text-gray-600 mx-auto mb-4" />
    <h3 className="text-xl font-medium text-white mb-2">No Roles</h3>
    <p className="text-gray-400 mb-6 max-w-md mx-auto">
      Create your first role to manage access permissions across EnvSync. Roles
      allow you to define what actions team members can perform and which
      features they can access.
    </p>
    <RoleEditForm>
      <Button className="bg-electric_indigo-500 hover:bg-electric_indigo-600 text-white">
        <Plus className="size-4 mr-2" />
        Create New Role
      </Button>
    </RoleEditForm>
  </div>
);
