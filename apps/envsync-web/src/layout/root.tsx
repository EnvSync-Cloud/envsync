import { Header } from "@/components/Header";
import { Sidebar } from "@/components/Sidebar";
import { CommandPalette } from "@/components/CommandPalette";
import { KeyboardShortcutsDialog } from "@/components/KeyboardShortcutsDialog";
import { NotificationCenter } from "@/components/NotificationCenter";
import { useAuth } from "@/hooks/useAuth";
import { useSidebar } from "@/hooks/useSidebar";
import { Outlet } from "react-router-dom";
import { useEffect } from "react";

export const RootLayout = () => {
  const { user, isAuthenticated, isLoading, authError } = useAuth();
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
      <div className="flex items-center justify-center h-screen bg-[#0a0f1a]">
        <div className="flex flex-col items-center space-y-4">
          <div className="relative">
            <img
              src="/EnvSync.svg"
              alt="EnvSync"
              className="size-16 animate-pulse"
            />
          </div>
          <p className="text-gray-400 text-sm">Loading your workspace...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated || !user) {
    return (
      <div className="min-h-screen bg-[#0a0f1a] flex flex-col items-center justify-center px-4">
        <div className="max-w-md w-full space-y-6 text-center">
          <div className="mx-auto mb-6">
            <img src="/EnvSync.svg" alt="EnvSync" className="w-20 h-20 mx-auto" />
          </div>
          <h2 className="text-2xl font-semibold text-gray-100">
            Authentication Required
          </h2>
          <p className="text-gray-400">
            {authError ?? "You need to be signed in to access EnvSync."}
          </p>
          <div className="pt-4">
            <button
              onClick={() => window.location.reload()}
              className="px-6 py-2.5 bg-violet-500 hover:bg-violet-600 text-white font-medium rounded-lg transition-colors"
            >
              Sign In
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen bg-[#0a0f1a] text-white flex overflow-hidden">
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
        {/* Fixed Header */}
        <div className="flex-shrink-0">
          <Header />
        </div>

        {/* Scrollable Content */}
        <main className="flex-1 p-6 overflow-y-auto">
          <Outlet />
        </main>
      </div>

      {/* Global overlays */}
      <CommandPalette />
      <KeyboardShortcutsDialog />
      <NotificationCenter />
    </div>
  );
};

export default RootLayout;
