import { LogOut, Menu, ChevronLeft, Keyboard } from "lucide-react";
import { cn } from "@/lib/utils";
import { Link, useLocation } from "react-router-dom";
import { useMemo } from "react";
import { navGroups } from "@/constants";
import { useAuthContext } from "@/contexts/auth";

interface SidebarProps {
  expanded: boolean;
  onToggle: () => void;
}

export const Sidebar = ({ expanded, onToggle }: SidebarProps) => {
  const { user, token, allowedScopes } = useAuthContext();
  const { pathname } = useLocation();

  const authorizedGroups = useMemo(
    () =>
      navGroups
        .map((group) => ({
          ...group,
          items: group.items.filter((item) => allowedScopes.includes(item.id)),
        }))
        .filter((group) => group.items.length > 0),
    [allowedScopes]
  );

  const activeView = pathname === "/" ? "dashboard" : pathname.split("/")[1] || "dashboard";

  const handleLogout = () => {
    localStorage.removeItem("access_token");
    const logoutUrl = `https://envsync.eu.auth0.com/oidc/logout?post_logout_redirect_uri=${encodeURIComponent(
      window.location.origin
    )}&id_token_hint=${token}`;
    window.location.href = logoutUrl;
  };

  return (
    <div
      className={cn(
        "h-full bg-gray-900 border-r border-gray-800 flex flex-col transition-all duration-300 ease-in-out",
        expanded ? "w-64" : "w-16"
      )}
    >
      {/* Logo area */}
      <div className="px-4 py-5 flex-shrink-0 border-b border-gray-800">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <img src="/EnvSync.svg" alt="EnvSync" className="size-10" />
          </div>
          <button
            onClick={onToggle}
            className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-gray-800 transition-colors"
            title={expanded ? "Collapse sidebar" : "Expand sidebar"}
          >
            {expanded ? (
              <ChevronLeft className="size-4" />
            ) : (
              <Menu className="size-4" />
            )}
          </button>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-2 py-3 overflow-y-auto overflow-x-clip space-y-4">
        {authorizedGroups.map((group, groupIdx) => (
          <div key={group.label}>
            {/* Section label (visible when expanded) */}
            {expanded ? (
              <div className="px-3 mb-1.5">
                <span className="text-[11px] font-medium uppercase tracking-wider text-gray-500">
                  {group.label}
                </span>
              </div>
            ) : (
              groupIdx > 0 && (
                <div className="mx-3 mb-2 border-t border-gray-800" />
              )
            )}

            <div className="space-y-0.5">
              {group.items.map((item) => {
                const Icon = item.icon;
                const isActive = activeView === item.id;

                return (
                  <div key={item.id} className="relative group">
                    <Link
                      to={item.id === "dashboard" ? "/" : `/${item.id}`}
                      className={cn(
                        "w-full flex items-center rounded-lg text-left transition-all duration-200 text-sm font-medium relative",
                        expanded
                          ? "px-3 py-2 space-x-3"
                          : "px-2 py-2 justify-center",
                        isActive
                          ? "bg-violet-500/10 text-white border-l-2 border-violet-500"
                          : "text-gray-400 hover:bg-gray-800/50 hover:text-gray-200 border-l-2 border-transparent"
                      )}
                      title={!expanded ? item.name : undefined}
                    >
                      <Icon className="size-[18px] flex-shrink-0" />
                      {expanded && (
                        <span className="transition-opacity duration-200">
                          {item.name}
                        </span>
                      )}
                    </Link>

                    {/* Tooltip for collapsed state */}
                    {!expanded && (
                      <div className="absolute left-full ml-2 px-2.5 py-1.5 bg-gray-800 text-white text-xs rounded-md opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-150 whitespace-nowrap z-50 top-1/2 -translate-y-1/2 border border-gray-700">
                        {item.name}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Help button */}
      {expanded && (
        <div className="px-4 pb-2">
          <button
            onClick={() => {
              window.dispatchEvent(new CustomEvent("open-shortcuts-dialog"));
            }}
            className="w-full flex items-center space-x-2 px-3 py-2 text-gray-500 hover:text-gray-300 hover:bg-gray-800/50 rounded-lg transition-colors text-xs"
          >
            <Keyboard className="size-3.5" />
            <span>Keyboard shortcuts</span>
            <kbd className="ml-auto text-[10px] bg-gray-800 text-gray-500 px-1.5 py-0.5 rounded border border-gray-700">
              ?
            </kbd>
          </button>
        </div>
      )}

      {/* User profile section */}
      {user && (
        <div className="p-3 border-t border-gray-800 flex-shrink-0">
          <div
            className={cn(
              "flex items-center transition-all duration-300",
              expanded ? "space-x-3" : "justify-center"
            )}
          >
            <div className="relative flex-shrink-0">
              <div className="w-8 h-8 bg-gray-800 rounded-full flex items-center justify-center">
                {user.user.profile_picture_url ? (
                  <img
                    src={user.user.profile_picture_url}
                    alt="Avatar"
                    className="w-full h-full rounded-full object-cover"
                  />
                ) : (
                  <span className="text-gray-200 font-medium text-sm">
                    {user.user.full_name?.charAt(0)?.toUpperCase() || "U"}
                  </span>
                )}
              </div>
              {/* Online indicator */}
              <div className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-green-500 rounded-full border-2 border-gray-900" />
            </div>

            {expanded && (
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-200 truncate">
                  {user.user.full_name ?? ""}
                </p>
                <p className="text-[11px] text-gray-500 truncate">
                  {user.user.email ?? ""}
                </p>
              </div>
            )}

            {expanded && (
              <div className="relative group">
                <button
                  onClick={handleLogout}
                  className="p-1.5 text-gray-500 hover:text-gray-300 hover:bg-gray-800 rounded-lg transition-colors"
                  title="Logout"
                >
                  <LogOut className="w-4 h-4" />
                </button>

                <div className="absolute left-full ml-2 px-2.5 py-1.5 bg-gray-800 text-white text-xs rounded-md opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-150 whitespace-nowrap z-50 top-1/2 -translate-y-1/2 border border-gray-700">
                  Logout
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
