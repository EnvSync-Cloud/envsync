import { Header } from "@/components/Header";
import { Sidebar } from "@/components/Sidebar";
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
      <div className="flex items-center justify-center h-screen bg-slate-900">
        <div className="flex flex-col items-center space-y-4">
          <div className="size-12 border-4 border-t-emerald-500 border-slate-700 rounded-full animate-spin"></div>
          <p className="text-slate-400">Loading your data...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated || !user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex flex-col items-center justify-center px-4">
        <div className="max-w-md w-full space-y-6 text-center">
          <div className="mx-auto w-20 h-20 rounded-xl flex items-center justify-center mb-6">
            <img src="/EnvSync.svg" alt="EnvSync Logo" className="w-20 h-20" />
          </div>
          <h2 className="text-2xl font-bold text-white">
            Authentication Required
          </h2>
          <p className="text-slate-400">
            {authError ?? "You need to be signed in to access EnvSync."}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen bg-slate-900 text-white flex overflow-hidden">
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

      {/* Keyboard Shortcut Indicator (Optional - for development/debugging) */}
      {process.env.NODE_ENV === "development" && (
        <div className="fixed bottom-4 right-4 bg-slate-800 text-slate-300 px-3 py-2 rounded-lg text-xs opacity-50 hover:opacity-100 transition-opacity">
          Press{" "}
          <kbd className="bg-slate-700 px-1 py-0.5 rounded text-xs">Ctrl+B</kbd>{" "}
          to toggle sidebar
        </div>
      )}
    </div>
  );
};

export default RootLayout;
