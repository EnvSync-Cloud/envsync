import { BrowserRouter, Route, Routes } from "react-router-dom";

import RootLayout from "@/layout/root";

import Dashboard from "@/pages/Dashboard";
import Applications from "@/pages/Applications";
import AuditLogs from "@/pages/AuditLogs";
import UserSettings from "@/pages/UserSettings";
import OrgSettings from "@/pages/OrgSettings";
import Roles from "./Roles";
import Users from "@/pages/Users";
import Callback from "@/pages/Callback";
import NotFound from "@/pages/NotFound";
import ApiKeys from "@/pages/ApiKeys";
import Webhooks from "@/pages/Webhooks";
import GpgKeys from "@/pages/GpgKeys";
import Certificates from "@/pages/Certificates";
import ProjectEnvironments from "@/pages/ProjectVariables";
import ProjectSecrets from "@/pages/ProjectSecrets";
import CreateProject from "@/pages/CreateProject";
import ManageEnvironment from "@/pages/ManageEnvironment";
import PointInTimeVariables from "@/pages/PointInTimeVariables";

export const AppRoutes = () => {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/auth/callback" element={<Callback />} />
        <Route path="/" element={<RootLayout />}>
          <Route index element={<Dashboard />} />
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="applications" element={<Applications />} />
          <Route path="applications/create" element={<CreateProject />} />
          <Route
            path="applications/:projectNameId"
            element={<ProjectEnvironments />}
          />
          <Route
            path="applications/:projectNameId/secrets"
            element={<ProjectSecrets />}
          />
          <Route
            path="applications/:projectNameId/manage-environments"
            element={<ManageEnvironment />}
          />
          <Route
            path="applications/pit/:projectNameId"
            element={<PointInTimeVariables />}
          />
          <Route path="roles" element={<Roles />} />
          <Route path="users" element={<Users />} />
          <Route path="settings" element={<UserSettings />} />
          <Route path="organisation" element={<OrgSettings />} />
          <Route path="audit" element={<AuditLogs />} />
          <Route path="apikeys" element={<ApiKeys />} />
          <Route path="webhooks" element={<Webhooks />} />
          <Route path="gpgkeys" element={<GpgKeys />} />
          <Route path="certificates" element={<Certificates />} />
        </Route>
        <Route path="*" element={<NotFound />} />
      </Routes>
    </BrowserRouter>
  );
};

export default AppRoutes;
