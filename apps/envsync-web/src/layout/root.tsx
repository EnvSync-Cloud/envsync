import { Header } from "@/components/Header";
import { Sidebar } from "@/components/Sidebar";
import { CommandPalette } from "@/components/CommandPalette";
import { KeyboardShortcutsDialog } from "@/components/KeyboardShortcutsDialog";
import { NotificationCenter } from "@/components/NotificationCenter";
import { useAuthContext } from "@/contexts/auth";
import { useSidebar } from "@/hooks/useSidebar";
import { redirectToLogin } from "@/api";
import { Outlet } from "react-router-dom";
import { useEffect } from "react";

export const RootLayout = () => {
  const { user, isAuthenticated, isLoading, authError } = useAuthContext();
  const { sidebarExpanded, toggleSidebar } = useSidebar();

  // Save sidebar state to localStorage whenever it changes
  useEffect(() => {
    try {
      localStorage.setItem(
        "envsync-sidebar-expanded",
        JSON.stringify(sidebarExpanded)
      );
    } catch (error) {
      console.warn("Failed to save sidebar state to localStorage:", error);
    }
  }, [sidebarExpanded]);

  // Keyboard shortcut to toggle sidebar
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key === "b") {
        event.preventDefault();
        toggleSidebar();
      }

      if (
        (event.ctrlKey || event.metaKey) &&
        event.shiftKey &&
        event.key === "S"
      ) {
        event.preventDefault();
        toggleSidebar();
      }
    };

    if (isAuthenticated && user) {
      document.addEventListener("keydown", handleKeyDown);
    }

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isAuthenticated, user, toggleSidebar]);

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center space-y-4">
          <div className="relative">
            <img
              src="/EnvSync.svg"
              alt="EnvSync"
              className="size-16 animate-pulse"
            />
          </div>
          <p className="text-muted-foreground text-sm">Loading your organization...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated || !user) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center px-4">
        <div className="max-w-md w-full space-y-6 text-center">
          <div className="mx-auto mb-6">
            <img src="/EnvSync.svg" alt="EnvSync" className="w-20 h-20 mx-auto" />
          </div>
          <h2 className="text-2xl font-medium text-foreground">
            Authentication Required
          </h2>
          <p className="text-muted-foreground">
            {authError ?? "You need to be signed in to access EnvSync."}
          </p>
          <div className="pt-4">
            <button
              onClick={() => void redirectToLogin()}
              className="px-6 py-2.5 bg-primary hover:bg-primary-hover text-primary-foreground font-medium rounded-lg transition-colors"
            >
              Sign In
            </button>
          </div>
          <div className="pt-4">
            <button
              onClick={() => {
                localStorage.clear();
                window.location.reload();
              }}
              className="px-6 py-2.5 bg-red-500 hover:bg-red-600 text-white font-medium rounded-lg transition-colors"
            >
              Clear Local Storage
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden bg-background text-foreground">
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-primary/[0.035] rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-primary/[0.025] rounded-full blur-3xl" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(255,255,255,0.04),_transparent_45%)]" />
      </div>

      <div
        className={`fixed left-0 top-0 h-full z-30 transition-all duration-300 ease-in-out ${
          sidebarExpanded ? "w-64" : "w-16"
        }`}
      >
        <Sidebar expanded={sidebarExpanded} onToggle={toggleSidebar} />
      </div>

      {/* Main Content Area */}
      <div
        className={`flex-1 h-screen flex flex-col overflow-hidden transition-all duration-300 ease-in-out ${
          sidebarExpanded ? "ml-64" : "ml-16"
        }`}
      >
        <div className="flex-shrink-0">
          <Header />
        </div>

        <main className="flex-1 overflow-y-auto">
          <div className="mx-auto w-full max-w-[1600px] px-5 py-6 md:px-6">
            <Outlet />
          </div>
        </main>
      </div>

      <CommandPalette />
      <KeyboardShortcutsDialog />
      <NotificationCenter />
    </div>
  );
};

export default RootLayout;
