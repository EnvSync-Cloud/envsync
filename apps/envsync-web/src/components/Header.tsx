import { Search, Bell, LogOut, Settings, Globe } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuthContext } from "@/contexts/auth";
import { OrgSwitcher } from "@/components/shell/OrgSwitcher";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { logoutWebSession } from "@/api";
import { runtimeConfig } from "@/utils/runtime-config";
import { orgSettingsPath } from "@/lib/app-routes";

export const Header = () => {
  const { user } = useAuthContext();
  const navigate = useNavigate();

  const handleLogout = async () => {
    try {
      await logoutWebSession();
    } catch (error) {
      console.error("Failed to logout cleanly:", error);
    }
  };

  const isMac = navigator.platform.toUpperCase().indexOf("MAC") >= 0;

  return (
    <header className="border-b border-border bg-background/70 px-6 py-3 backdrop-blur-xl">
      <div className="flex items-center justify-between gap-3">
        <OrgSwitcher variant="header" />

        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={() =>
              window.dispatchEvent(new CustomEvent("open-command-palette"))
            }
            className="group flex min-w-[240px] flex-1 items-center gap-3 rounded-xl border border-border bg-secondary px-4 py-2 text-tertiary transition-all hover:border-primary/30 hover:bg-primary/5 hover:text-primary md:flex-none"
          >
            <Search className="size-4" />
            <span className="text-sm">Search…</span>
            <kbd className="ml-auto rounded border border-border bg-muted px-1.5 py-0.5 text-[10px] text-tertiary transition-colors group-hover:text-foreground">
              {isMac ? "⌘" : "Ctrl+"}K
            </kbd>
          </button>

          <button
            onClick={() =>
              window.dispatchEvent(
                new CustomEvent("toggle-notification-center")
              )
            }
            className="relative rounded-xl border border-border bg-secondary p-2.5 text-muted-foreground transition-colors hover:border-primary/30 hover:bg-primary/10 hover:text-primary"
            title="Notifications"
          >
            <Bell className="size-4" />
          </button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex items-center gap-3 rounded-2xl border border-border bg-secondary px-3 py-2 transition-colors hover:border-primary/30 hover:bg-secondary/80">
                <div className="flex min-w-0 flex-col text-right">
                  <span className="truncate text-sm font-medium text-foreground">
                    {user?.user?.full_name ?? "User"}
                  </span>
                </div>
                <div className="flex h-8 w-8 items-center justify-center rounded-full border border-border bg-muted transition-colors hover:border-primary/50">
                  {user?.user?.profile_picture_url ? (
                    <img
                      src={user.user.profile_picture_url}
                      alt="Avatar"
                      className="w-full h-full rounded-full object-cover"
                    />
                  ) : (
                    <span className="text-foreground font-medium text-xs">
                      {user?.user?.full_name?.charAt(0)?.toUpperCase() || "U"}
                    </span>
                  )}
                </div>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              className="w-48 bg-popover border-border"
            >
              <div className="px-2 py-1.5">
                <p className="text-sm font-medium text-foreground truncate">
                  {user?.user?.full_name ?? "User"}
                </p>
                <p className="hdx-mask text-xs text-tertiary truncate">
                  {user?.user?.email ?? ""}
                </p>
                {runtimeConfig.releaseVersion && (
                  <p className="text-[11px] text-muted-foreground/60">
                    {`v${runtimeConfig.releaseVersion}`}
                    {runtimeConfig.activeApiSlot ? ` · slot ${runtimeConfig.activeApiSlot}` : ""}
                  </p>
                )}
              </div>
              <DropdownMenuSeparator className="bg-border" />
              <DropdownMenuItem
                onClick={() => navigate("/settings")}
                className="text-foreground focus:bg-muted focus:text-foreground cursor-pointer"
              >
                <Settings className="size-4 mr-2" />
                Account Settings
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => navigate(orgSettingsPath())}
                className="text-foreground focus:bg-muted focus:text-foreground cursor-pointer"
              >
                <Globe className="size-4 mr-2" />
                Organization
              </DropdownMenuItem>
              <DropdownMenuSeparator className="bg-border" />
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
