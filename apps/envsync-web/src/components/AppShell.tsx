import type { ReactNode } from "react";
import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "react-router-dom";

import { Header } from "@/components/Header";
import { Sidebar } from "@/components/Sidebar";
import { sdk } from "@/api/base";
import { API_KEYS } from "@/constants";
import { getShellContext, writeLastProjectId } from "@/lib/shell-context";

interface AppShellProps {
  sidebarExpanded: boolean;
  onToggleSidebar: () => void;
  children: ReactNode;
}

export function AppShell({ sidebarExpanded, onToggleSidebar, children }: AppShellProps) {
  const { pathname } = useLocation();
  const context = getShellContext(pathname);

  const { data: projects = [] } = useQuery({
    queryKey: [API_KEYS.ALL_APPLICATIONS, "shell"],
    queryFn: async () => {
      const appsData = await sdk.applications.getApps();
      return appsData.map((app) => ({
        id: app.id,
        name: app.name,
      }));
    },
    staleTime: 5 * 60 * 1000,
  });

  useEffect(() => {
    if (context.appId) {
      writeLastProjectId(context.appId);
    }
  }, [context.appId]);

  return (
    <div data-testid="app-shell" className="flex h-screen overflow-hidden bg-background text-foreground">
      <div className="pointer-events-none fixed inset-0">
        <div className="absolute left-1/4 top-0 h-96 w-96 rounded-full bg-primary/[0.035] blur-3xl" />
        <div className="absolute bottom-0 right-1/4 h-96 w-96 rounded-full bg-primary/[0.025] blur-3xl" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(255,255,255,0.04),_transparent_45%)]" />
      </div>

      <div
        className={`fixed left-0 top-0 z-30 h-full transition-all duration-300 ease-in-out ${
          sidebarExpanded ? "w-64" : "w-16"
        }`}
      >
        <Sidebar
          expanded={sidebarExpanded}
          onToggle={onToggleSidebar}
          product={context.product}
          appId={context.appId}
          projects={projects}
        />
      </div>

      <div
        className={`flex h-screen flex-1 flex-col overflow-hidden transition-all duration-300 ease-in-out ${
          sidebarExpanded ? "ml-64" : "ml-16"
        }`}
      >
        <div className="flex-shrink-0">
          <Header />
        </div>
        <main className="flex-1 overflow-y-auto">
          <div className="mx-auto w-full max-w-[1600px] px-5 py-6 md:px-6">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
