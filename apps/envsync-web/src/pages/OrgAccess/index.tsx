import { Navigate, useNavigate, useParams } from "react-router-dom";
import { ShieldAlert, User, Users } from "lucide-react";

import { useAuthContext } from "@/contexts/auth";
import { isOrgAccessTab, orgAccessPath, type OrgAccessTab } from "@/lib/app-routes";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import UsersPage from "@/pages/Users";
import TeamsPage from "@/pages/Teams";
import RolesPage from "@/pages/Roles";

const TAB_META: Array<{
  id: OrgAccessTab;
  label: string;
  icon: typeof User;
  adminOnly?: boolean;
}> = [
  { id: "users", label: "Users", icon: User },
  { id: "teams", label: "Teams", icon: Users },
  { id: "roles", label: "Roles", icon: ShieldAlert, adminOnly: true },
];

export const OrgAccess = () => {
  const { tab } = useParams<{ tab?: string }>();
  const navigate = useNavigate();
  const { user, isLoading } = useAuthContext();
  const canViewRoles = Boolean(user?.role?.is_admin || user?.role?.is_master);

  if (!tab) {
    return <Navigate to={orgAccessPath("users")} replace />;
  }

  if (!isOrgAccessTab(tab)) {
    return <Navigate to={orgAccessPath("users")} replace />;
  }

  if (!isLoading && tab === "roles" && !canViewRoles) {
    return <Navigate to={orgAccessPath("users")} replace />;
  }

  const visibleTabs = TAB_META.filter((item) => !item.adminOnly || canViewRoles);

  return (
    <div className="space-y-6" data-testid="org-access-page">
      <Tabs
        value={tab}
        onValueChange={(value) => navigate(orgAccessPath(value as OrgAccessTab))}
      >
        <TabsList data-testid="org-access-tabs" className="h-auto bg-transparent p-0">
          {visibleTabs.map((item) => {
            const Icon = item.icon;
            return (
              <TabsTrigger
                key={item.id}
                data-testid={`org-access-tab-${item.id}`}
                value={item.id}
                className="rounded-xl data-[state=active]:bg-emerald-500/18 data-[state=active]:text-foreground"
              >
                <Icon className="mr-2 size-4" />
                {item.label}
              </TabsTrigger>
            );
          })}
        </TabsList>
      </Tabs>

      {tab === "users" && <UsersPage />}
      {tab === "teams" && <TeamsPage />}
      {tab === "roles" && <RolesPage />}
    </div>
  );
};

export default OrgAccess;
