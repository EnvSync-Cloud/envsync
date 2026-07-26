import { Plus, ShieldAlert } from "lucide-react";
import { Button } from "../ui/button";
import { RoleEditForm } from "./edit-form";

export const EmptyRoles = () => (
  <div className="text-center py-12">
    <ShieldAlert className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
    <h3 className="text-xl font-medium text-foreground mb-2">No Roles</h3>
    <p className="text-muted-foreground mb-6 max-w-md mx-auto">
      Create your first role to manage access permissions across EnvSync. Roles
      allow you to define what actions team members can perform and which
      features they can access.
    </p>
    <RoleEditForm>
      <Button className="bg-emerald-500 hover:bg-emerald-600 text-white">
        <Plus className="size-4 mr-2" />
        Create New Role
      </Button>
    </RoleEditForm>
  </div>
);
