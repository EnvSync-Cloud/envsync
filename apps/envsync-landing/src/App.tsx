import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { 
  createBrowserRouter,
  createRoutesFromElements,
  Outlet,
  Route,
  RouterProvider,
} from "react-router-dom";
import { RouteChangeTracker } from "@/telemetry";
import Index from "./pages/Index";
import About from "./pages/About";
import Onboarding from "./pages/Onboarding";
import Integrations from "./pages/Integrations";
import NotFound from "./pages/NotFound";
import AcceptOrgInvite from "./pages/AcceptOrgInvite";
import AcceptUserInvite from "./pages/AcceptUserInvite";
import Showcase from "./pages/Showcase";

const queryClient = new QueryClient();

const TelemetryLayout = () => (
  <>
    <RouteChangeTracker />
    <Outlet />
  </>
);

const router = createBrowserRouter(
  createRoutesFromElements(
    <Route element={<TelemetryLayout />}>
      <Route path="/" element={<Index />} />
      <Route path="/about" element={<About />} />
      <Route path="/onboarding" element={<Onboarding />} />
      <Route path="/onboarding/accept-org-invite/:invite_code" element={<AcceptOrgInvite />} />
      <Route path="/onboarding/accept-user-invite/:invite_code" element={<AcceptUserInvite />} />
      <Route path="/integrations" element={<Integrations />} />
      {import.meta.env.DEV && <Route path="/__showcase" element={<Showcase />} />}
      <Route path="*" element={<NotFound />} />
    </Route>
  )
);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <RouterProvider router={router} />
      <Toaster />
      <Sonner />
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
