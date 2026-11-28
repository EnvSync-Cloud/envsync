import { useMemo } from "react";
import { ShieldAlert } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { PageShell } from "@/components/PageShell";
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
    <PageShell
      title="Roles"
      icon={ShieldAlert}
      description="Permission sets that can be assigned to members."
      stats={[{ label: (roles?.length ?? 0) === 1 ? "role" : "roles", value: String(roles?.length ?? 0) }]}
      actions={<RoleEditForm />}
    >
      <Card className="w-full border-border bg-card">
        <CardContent className="pt-6">
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
    </PageShell>
  );
};

export default Roles;
