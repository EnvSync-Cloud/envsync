import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useRolesTable } from "@/hooks/useRoles";
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
    <div className="flex flex-col gap-4">
      <div className="flex w-full items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Roles</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {roles?.length ?? 0} roles
          </p>
        </div>
        <RoleEditForm />
      </div>
      <Card className="w-full border-border bg-card">
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-medium text-foreground">
            Roles
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
