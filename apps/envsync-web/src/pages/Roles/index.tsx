import { ShieldAlert } from "lucide-react";
import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useRolesTable } from "@/hooks/useRoles";
import { Count } from "@/components/ui/count";
import { RoleRow } from "@/components/roles/row";
import { RoleEditForm } from "@/components/roles/edit-form";
import { RoleRowSkeleton } from "@/components/roles/loading";
import { EmptyRoles } from "@/components/roles/empty";

export const Roles = () => {
  const { isLoading, data: roles } = useRolesTable();

  const isEmpty = useMemo(() => {
    return !isLoading && roles?.length === 0;
  }, [isLoading, roles]);

  return (
    <div className="animate-page-enter flex flex-col items-start sm:items-center justify-between gap-4">
      <div className="flex justify-between items-center w-full">
        <div className="flex items-center space-x-3">
          <div className="p-2 bg-emerald-500/10 rounded-lg ring-1 ring-emerald-500/20">
            <ShieldAlert className="size-5 text-emerald-400" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-foreground tracking-tight">Roles</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Manage roles and assign permissions to control what users can access
              across the platform.
            </p>
          </div>
        </div>
        <RoleEditForm />
      </div>
      <Card className="bg-card text-card-foreground border-border shadow-xl rounded-xl w-full mt-2">
        <CardHeader>
          <CardTitle className="text-foreground flex items-center gap-3">
            <ShieldAlert className="size-8 bg-emerald-400 border border-emerald-600 p-2 stroke-[3] text-white rounded-md" />
            Roles
            <Count size="xl" variant="subtle" count={roles?.length} />
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isEmpty ? (
            <EmptyRoles />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border">
                    {[
                      "Name",
                      "Access Level",
                      "Features",
                      "Assigned",
                      "Created",
                    ].map((header) => (
                      <th
                        key={header}
                        className="text-left py-3 px-4 text-muted-foreground font-medium"
                      >
                        {header}
                      </th>
                    ))}
                    <th className="text-right py-3 px-4 text-muted-foreground font-medium">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {isLoading
                    ? Array.from({ length: 6 }, (_, index) => (
                        <RoleRowSkeleton key={index} />
                      ))
                    : roles?.map((role) => (
                        <RoleRow key={role.id} role={role} />
                      ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default Roles;
