import { Search, Bell, LogOut, Settings, Globe, Sparkles, ChevronsUpDown, Check, Loader2, Plus } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { useBreadcrumbs } from "@/hooks/useBreadcrumbs";
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
import { Fragment, useMemo, useState } from "react";
import { logoutWebSession } from "@/api";
import { canCreateOrganizationInUi, runtimeConfig } from "@/utils/runtime-config";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { CreateOrganizationDialog } from "@/components/auth/CreateOrganizationDialog";
import { ThemeToggle } from "@/components/ui/ThemeToggle";

export const Header = () => {
  const { user, memberships, activeMembershipUserId, switchOrg, isSwitchingOrg, isCreatingOrganization } = useAuthContext();
  const breadcrumbs = useBreadcrumbs();
  const navigate = useNavigate();
  const [orgSwitcherOpen, setOrgSwitcherOpen] = useState(false);
  const [createOrganizationOpen, setCreateOrganizationOpen] = useState(false);
  const activeMembership = useMemo(
    () =>
      memberships.find((membership) => membership.user_id === activeMembershipUserId)
      ?? memberships.find((membership) => membership.is_active)
      ?? null,
    [activeMembershipUserId, memberships],
  );
  const activeOrgName = activeMembership?.org_name || user?.org?.name || "EnvSync Workspace";
  const activeRole = activeMembership?.role_name || user?.role?.name || "Member";
  const canSwitchOrganizations = runtimeConfig.edition === "enterprise";
  const canCreateOrganization = canCreateOrganizationInUi(runtimeConfig);

  const handleLogout = async () => {
    try {
      await logoutWebSession();
    } catch (error) {
      console.error("Failed to logout cleanly:", error);
    }
  };

  const isMac = navigator.platform.toUpperCase().indexOf("MAC") >= 0;

  return (
    <>
      <header className="border-b border-border bg-background/70 px-6 py-3 backdrop-blur-xl">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <div className="min-w-0">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            {canSwitchOrganizations ? (
              <Popover open={orgSwitcherOpen} onOpenChange={setOrgSwitcherOpen}>
                <PopoverTrigger asChild>
                  <button
                    data-testid="organization-switcher-trigger"
                    className="inline-flex items-center gap-3 rounded-full border border-primary/20 bg-primary/10 px-3 py-1.5 text-left text-primary-foreground transition-colors hover:border-primary/30 hover:bg-primary/14"
                  >
                    <span className="inline-flex size-6 items-center justify-center rounded-full border border-primary/20 bg-primary/15">
                      <Sparkles className="size-3 text-primary" />
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium text-primary">
                        {activeOrgName}
                      </span>
                    </span>
                    {isSwitchingOrg || isCreatingOrganization ? (
                      <Loader2 className="size-4 animate-spin text-primary/70" />
                    ) : (
                      <ChevronsUpDown className="size-4 text-primary/70" />
                    )}
                  </button>
                </PopoverTrigger>
                <PopoverContent align="start" className="w-[340px] border-border bg-popover p-0">
                  <Command className="bg-transparent text-foreground">
                    <div className="border-b border-border px-4 py-3">
                      <p className="text-[11px] uppercase tracking-[0.22em] text-tertiary">Active organization</p>
                      <p className="mt-1 truncate text-sm font-medium text-foreground">{activeOrgName}</p>
                      <p className="truncate text-xs text-tertiary">{activeRole}</p>
                    </div>
                    <CommandInput placeholder="Search organizations..." className="text-foreground placeholder:text-tertiary" />
                    <CommandList className="max-h-[320px]">
                      <CommandEmpty className="text-tertiary">No organizations found.</CommandEmpty>
                      <CommandGroup heading="Your organizations">
                        {memberships.map((membership) => {
                          const isActive = membership.user_id === activeMembershipUserId || membership.is_active;
                          return (
                            <CommandItem
                              key={membership.user_id}
                              data-testid={`organization-switcher-item-${membership.org_slug}`}
                              value={`${membership.org_name} ${membership.org_slug} ${membership.role_name}`}
                              onSelect={() => {
                                setOrgSwitcherOpen(false);
                                void switchOrg(membership.org_id);
                              }}
                              disabled={isSwitchingOrg || isCreatingOrganization}
                              className="flex items-center gap-3 rounded-xl px-3 py-3 data-[selected=true]:bg-muted"
                            >
                              <span className="inline-flex size-9 items-center justify-center rounded-xl border border-primary/20 bg-primary/10 text-primary">
                                <Globe className="size-4" />
                              </span>
                              <span className="min-w-0 flex-1">
                                <span className="block truncate text-sm font-medium text-foreground">
                                  {membership.org_name}
                                </span>
                                <span className="block truncate text-xs text-tertiary">
                                  {membership.org_slug} · {membership.role_name}
                                </span>
                              </span>
                              {isActive && <Check className="size-4 text-primary" />}
                            </CommandItem>
                          );
                        })}
                      </CommandGroup>
                      {canCreateOrganization && (
                        <>
                          <CommandSeparator className="bg-border" />
                          <CommandGroup heading="Organization">
                            <CommandItem
                              data-testid="create-organization-action"
                              value="create new organization"
                              onSelect={() => {
                                setOrgSwitcherOpen(false);
                                setCreateOrganizationOpen(true);
                              }}
                              disabled={isSwitchingOrg || isCreatingOrganization}
                              className="flex items-center gap-3 rounded-xl px-3 py-3 text-primary data-[selected=true]:bg-muted"
                            >
                              <span className="inline-flex size-9 items-center justify-center rounded-xl border border-primary/20 bg-primary/10 text-primary">
                                <Plus className="size-4" />
                              </span>
                              <span className="text-sm font-medium">+ Create organization</span>
                            </CommandItem>
                          </CommandGroup>
                        </>
                      )}
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            ) : (
              <span className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-sm font-medium text-primary">
                <Sparkles className="size-3" />
                {activeOrgName}
              </span>
            )}
          </div>

          <Breadcrumb>
            <BreadcrumbList>
              {breadcrumbs.map((crumb, index) => (
                <Fragment key={`${crumb.href}-${crumb.label}`}>
                  {index > 0 && (
                    <BreadcrumbSeparator className="text-muted-foreground/60" />
                  )}
                  <BreadcrumbItem>
                    {index === breadcrumbs.length - 1 ? (
                      <BreadcrumbPage className="text-sm font-medium text-foreground">
                        {crumb.label}
                      </BreadcrumbPage>
                    ) : (
                      <BreadcrumbLink asChild>
                        <Link
                          to={crumb.href}
                          className="text-sm text-muted-foreground transition-colors hover:text-foreground"
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
        </div>

        <div className="flex flex-wrap items-center gap-3 xl:justify-end">
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

          <ThemeToggle />

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
                onClick={() => navigate("/organisation")}
                className="text-foreground focus:bg-muted focus:text-foreground cursor-pointer"
              >
                <Globe className="size-4 mr-2" />
                Organisation
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
      <CreateOrganizationDialog
        open={createOrganizationOpen}
        onOpenChange={setCreateOrganizationOpen}
      />
    </>
  );
};
