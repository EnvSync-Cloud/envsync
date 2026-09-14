import { Navigate, useLocation, useParams } from "react-router-dom";

import { applyRouteParams } from "@/lib/app-routes";

export function LegacyRedirect({ to }: { to: string }) {
  const params = useParams();
  const { search, hash } = useLocation();
  const pathname = applyRouteParams(to, params);

  return <Navigate to={`${pathname}${search}${hash}`} replace />;
}

export default LegacyRedirect;
