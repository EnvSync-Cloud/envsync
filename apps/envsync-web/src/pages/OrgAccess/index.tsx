import { Navigate, useParams } from "react-router-dom";

import { useAuthContext } from "@/contexts/auth";
import { isOrgAccessTab, orgAccessPath } from "@/lib/app-routes";
import UsersPage from "@/pages/Users";
import TeamsPage from "@/pages/Teams";
import RolesPage from "@/pages/Roles";

export const OrgAccess = () => {
  const { tab } = useParams<{ tab?: string }>();
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

  return (
    <div className="space-y-6" data-testid="org-access-page">
      {tab === "users" && <UsersPage />}
      {tab === "teams" && <TeamsPage />}
      {tab === "roles" && <RolesPage />}
    </div>
  );
};

export default OrgAccess;
