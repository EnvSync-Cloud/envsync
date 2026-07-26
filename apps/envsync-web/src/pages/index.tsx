import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Suspense, lazy } from "react";
import { RouteChangeTracker } from "@/telemetry";
import { getWebRoutes } from "@/modules/load-modules";

import RootLayout from "@/layout/root";
import type { WebRouteDefinition } from "@/modules/types";

const Showcase = lazy(() => import("./Showcase"));

const webRoutes = getWebRoutes();

function RouteFallback() {
  return (
    <div className="flex min-h-[240px] items-center justify-center text-sm text-muted-foreground">
      Loading…
    </div>
  );
}

function RouteElement({ route }: { route: WebRouteDefinition }) {
  const Component = lazy(route.loadComponent);

  return (
    <Suspense fallback={<RouteFallback />}>
      <Component />
    </Suspense>
  );
}

function renderRoute(route: WebRouteDefinition) {
  if (route.index) {
    return <Route key={route.id} index element={<RouteElement route={route} />} />;
  }

  return <Route key={route.id} path={route.path} element={<RouteElement route={route} />} />;
}

export const AppRoutes = () => {
  const rootRoutes = webRoutes.filter((route) => (route.layout ?? "root") === "root");
  const standaloneRoutes = webRoutes.filter((route) => route.layout === "standalone");

  return (
    <BrowserRouter>
      <RouteChangeTracker />
      <Routes>
        <Route path="/" element={<RootLayout />}>
          {rootRoutes.map(renderRoute)}
        </Route>
        {standaloneRoutes.map(renderRoute)}
        {import.meta.env.DEV && (
          <Route
            path="/__showcase"
            element={
              <Suspense fallback={<RouteFallback />}>
                <Showcase />
              </Suspense>
            }
          />
        )}
      </Routes>
    </BrowserRouter>
  );
};

export default AppRoutes;
