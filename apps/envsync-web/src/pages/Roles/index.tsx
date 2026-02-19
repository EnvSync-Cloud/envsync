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
    <div className="flex flex-col items-start sm:items-center justify-between gap-4">
      <div className="flex justify-between items-center w-full">
        <div>
          <h1 className="text-3xl font-bold text-white">Roles</h1>
          <p className="text-gray-400 mt-2">
            Manage roles and assign permissions to control what users can access
            across the platform.
          </p>
        </div>
        <RoleEditForm />
      </div>
      <Card className="bg-card text-card-foreground bg-gradient-to-br from-gray-900 to-gray-950 border-gray-800 shadow-xl w-full mt-2">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-3">
            <ShieldAlert className="size-8 bg-violet-400 border border-violet-600 p-2 stroke-[3] text-white rounded-md" />
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
                  <tr className="border-b border-gray-700">
                    {[
                      "Name",
                      "Access Level",
                      "Features",
                      "Assigned",
                      "Created",
                    ].map((header) => (
                      <th
                        key={header}
                        className="text-left py-3 px-4 text-gray-400 font-medium"
                      >
                        {header}
                      </th>
                    ))}
                    <th className="text-right py-3 px-4 text-gray-400 font-medium">
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
