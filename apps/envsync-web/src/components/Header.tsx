import { Search, Bell, LogOut, Settings, Globe } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { useBreadcrumbs } from "@/hooks/useBreadcrumbs";
import { useAuth } from "@/hooks/useAuth";
import { useAuthContext } from "@/contexts/auth";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Fragment } from "react";

export const Header = () => {
  const { user } = useAuth();
  const { token } = useAuthContext();
  const breadcrumbs = useBreadcrumbs();
  const navigate = useNavigate();

  const handleLogout = () => {
    localStorage.removeItem("access_token");
    const logoutUrl = `https://envsync.eu.auth0.com/oidc/logout?post_logout_redirect_uri=${encodeURIComponent(
      window.location.origin
    )}&id_token_hint=${token}`;
    window.location.href = logoutUrl;
  };

  const isMac = navigator.platform.toUpperCase().indexOf("MAC") >= 0;

  return (
    <header className="bg-gray-900/50 border-b border-gray-800 px-6 py-3 backdrop-blur-sm">
      <div className="flex items-center justify-between h-10">
        {/* Left: Breadcrumbs */}
        <Breadcrumb>
          <BreadcrumbList>
            {breadcrumbs.map((crumb, index) => (
              <Fragment key={crumb.href}>
                {index > 0 && (
                  <BreadcrumbSeparator className="text-gray-600" />
                )}
                <BreadcrumbItem>
                  {index === breadcrumbs.length - 1 ? (
                    <BreadcrumbPage className="text-gray-200 font-medium text-sm">
                      {crumb.label}
                    </BreadcrumbPage>
                  ) : (
                    <BreadcrumbLink asChild>
                      <Link
                        to={crumb.href}
                        className="text-gray-400 hover:text-gray-200 text-sm transition-colors"
                      >
                        {crumb.label}
                      </Link>
                    </BreadcrumbLink>
                  )}
                </BreadcrumbItem>
              </Fragment>
            ))}
          </BreadcrumbList>
        </Breadcrumb>

        {/* Center: Command palette trigger */}
        <button
          onClick={() =>
            window.dispatchEvent(new CustomEvent("open-command-palette"))
          }
          className="hidden md:flex items-center space-x-3 bg-gray-800/60 border border-gray-700/50 rounded-lg px-3 py-1.5 text-gray-500 hover:text-gray-400 hover:border-gray-600 transition-all cursor-pointer group"
        >
          <Search className="size-3.5" />
          <span className="text-xs">Search or jump to...</span>
          <kbd className="text-[10px] bg-gray-700/50 text-gray-500 px-1.5 py-0.5 rounded border border-gray-600/50 group-hover:text-gray-400 transition-colors">
            {isMac ? "⌘" : "Ctrl+"}K
          </kbd>
        </button>

        {/* Right: User actions */}
        <div className="flex items-center space-x-2">
          {/* Notification bell */}
          <button
            onClick={() =>
              window.dispatchEvent(
                new CustomEvent("toggle-notification-center")
              )
            }
            className="relative p-2 text-gray-400 hover:text-gray-200 hover:bg-gray-800/50 rounded-lg transition-colors"
            title="Notifications"
          >
            <Bell className="size-4" />
          </button>

          {/* User dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex items-center space-x-2 p-1.5 rounded-lg hover:bg-gray-800/50 transition-colors">
                <div className="w-7 h-7 bg-gray-800 rounded-full flex items-center justify-center border border-gray-700">
                  {user?.user?.profile_picture_url ? (
                    <img
                      src={user.user.profile_picture_url}
                      alt="Avatar"
                      className="w-full h-full rounded-full object-cover"
                    />
                  ) : (
                    <span className="text-gray-200 font-medium text-xs">
                      {user?.user?.full_name?.charAt(0)?.toUpperCase() || "U"}
                    </span>
                  )}
                </div>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              className="w-48 bg-gray-900 border-gray-800"
            >
              <div className="px-2 py-1.5">
                <p className="text-sm font-medium text-gray-200 truncate">
                  {user?.user?.full_name ?? "User"}
                </p>
                <p className="text-xs text-gray-500 truncate">
                  {user?.user?.email ?? ""}
                </p>
              </div>
              <DropdownMenuSeparator className="bg-gray-800" />
              <DropdownMenuItem
                onClick={() => navigate("/settings")}
                className="text-gray-300 focus:bg-gray-800 focus:text-gray-200 cursor-pointer"
              >
                <Settings className="size-4 mr-2" />
                Account Settings
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => navigate("/organisation")}
                className="text-gray-300 focus:bg-gray-800 focus:text-gray-200 cursor-pointer"
              >
                <Globe className="size-4 mr-2" />
                Organisation
              </DropdownMenuItem>
              <DropdownMenuSeparator className="bg-gray-800" />
              <DropdownMenuItem
                onClick={handleLogout}
                className="text-red-400 focus:bg-red-500/10 focus:text-red-400 cursor-pointer"
              >
                <LogOut className="size-4 mr-2" />
                Logout
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
};
