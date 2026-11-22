import { Building2, Check, ChevronsUpDown, Globe, Loader2, Plus } from "lucide-react";
import { useMemo, useState } from "react";

import { CreateOrganizationDialog } from "@/components/auth/CreateOrganizationDialog";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useAuthContext } from "@/contexts/auth";
import { cn } from "@/lib/utils";
import { canCreateOrganizationInUi, runtimeConfig } from "@/utils/runtime-config";

interface OrgSwitcherProps {
  expanded?: boolean;
  variant?: "sidebar" | "header";
}

export function OrgSwitcher({ expanded = true, variant = "sidebar" }: OrgSwitcherProps) {
  const {
    user,
    memberships,
    activeMembershipUserId,
    switchOrg,
    isSwitchingOrg,
    isCreatingOrganization,
  } = useAuthContext();
  const [open, setOpen] = useState(false);
  const [createOrganizationOpen, setCreateOrganizationOpen] = useState(false);
  const activeMembership = useMemo(
    () =>
      memberships.find((membership) => membership.user_id === activeMembershipUserId)
      ?? memberships.find((membership) => membership.is_current)
      ?? null,
    [activeMembershipUserId, memberships],
  );
  const activeOrgName = activeMembership?.org_name || user?.org?.name || "EnvSync Workspace";
  const activeRoleName = activeMembership?.role_name || user?.role?.name || "";
  const activeContextTitle = activeRoleName ? `${activeOrgName} · ${activeRoleName}` : activeOrgName;
  const canSwitchOrganizations =
    runtimeConfig.edition === "enterprise" && user?.auth_type !== "saml";
  const canCreateOrganization = canCreateOrganizationInUi(runtimeConfig);

  if (!canSwitchOrganizations) {
    return (
      <div
        className={cn(
          "flex items-center border border-sidebar-border bg-background text-foreground",
          variant === "header" ? "gap-2 rounded-xl px-3 py-1.5" : "rounded-2xl",
          expanded ? "gap-2 px-3 py-2" : "justify-center p-2",
        )}
        title={activeContextTitle}
      >
        <Building2 className="size-3.5 shrink-0 text-muted-foreground" />
        {(expanded || variant === "header") && (
          <span className="min-w-0">
            <span className="block truncate text-sm font-medium leading-tight">{activeOrgName}</span>
            {activeRoleName ? (
              <span className="block truncate text-[11px] leading-tight text-muted-foreground">{activeRoleName}</span>
            ) : null}
          </span>
        )}
      </div>
    );
  }

  return (
    <>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            data-testid="organization-switcher-trigger"
            className={cn(
              "flex items-center border border-sidebar-border bg-background text-left text-foreground transition-colors hover:bg-sidebar-accent",
              variant === "header"
                ? "max-w-[240px] gap-2 rounded-xl px-3 py-1.5"
                : "w-full rounded-2xl",
              variant !== "header" && (expanded ? "gap-2 px-3 py-2" : "justify-center p-2"),
            )}
            title={activeContextTitle}
            aria-label={activeContextTitle}
          >
            <span className="inline-flex size-6 shrink-0 items-center justify-center rounded-full border border-border bg-muted text-muted-foreground">
              {isSwitchingOrg || isCreatingOrganization ? (
                <Loader2 className="size-3 animate-spin" />
              ) : (
                <Building2 className="size-3" />
              )}
            </span>
            {(expanded || variant === "header") && (
              <>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium leading-tight">{activeOrgName}</span>
                  {activeRoleName ? (
                    <span className="block truncate text-[11px] leading-tight text-muted-foreground">{activeRoleName}</span>
                  ) : null}
                </span>
                <ChevronsUpDown className="size-3.5 shrink-0 text-muted-foreground" />
              </>
            )}
          </button>
        </PopoverTrigger>
        <PopoverContent
          align="start"
          side={variant === "header" ? "bottom" : "right"}
          className="w-[380px] border-border bg-popover p-0"
        >
          <Command className="bg-transparent text-foreground">
            <CommandInput placeholder="Search organizations..." className="text-foreground placeholder:text-tertiary" />
            <CommandList className="max-h-[320px]">
              <CommandEmpty className="text-tertiary">No organizations found.</CommandEmpty>
              <CommandGroup heading="Your organizations">
                {memberships.map((membership) => {
                  const isActive = membership.user_id === activeMembershipUserId || membership.is_current === true;
                  return (
                    <CommandItem
                      key={membership.user_id}
                      data-testid={`organization-switcher-item-${membership.org_slug}`}
                      value={`${membership.org_name} ${membership.org_slug} ${membership.role_name}`}
                      onSelect={() => {
                        setOpen(false);
                        void switchOrg(membership.org_id);
                      }}
                      disabled={isSwitchingOrg || isCreatingOrganization}
                      aria-label={`${membership.org_name}, role ${membership.role_name}`}
                      className="flex items-center gap-3 rounded-xl px-3 py-3 data-[selected=true]:bg-muted"
                    >
                      <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-lg border border-border bg-muted text-muted-foreground">
                        <Globe className="size-4" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium text-foreground">
                          {membership.org_name}
                        </span>
                        <span className="mt-0.5 block truncate text-xs text-tertiary">
                          {membership.org_slug}
                        </span>
                      </span>
                      <span className="max-w-[9.5rem] shrink-0 text-right">
                        <span className="block text-[10px] leading-none text-tertiary">Role</span>
                        <span className="mt-1 block text-xs font-medium leading-snug text-foreground">
                          {membership.role_name}
                        </span>
                      </span>
                      {isActive && <Check className="size-4 shrink-0 text-foreground" />}
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
                        setOpen(false);
                        setCreateOrganizationOpen(true);
                      }}
                      disabled={isSwitchingOrg || isCreatingOrganization}
                      className="flex items-center gap-3 rounded-lg px-3 py-3 text-accent-ink data-[selected=true]:bg-muted"
                    >
                      <span className="inline-flex size-9 items-center justify-center rounded-lg border border-border bg-muted text-muted-foreground">
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
      <CreateOrganizationDialog
        open={createOrganizationOpen}
        onOpenChange={setCreateOrganizationOpen}
      />
    </>
  );
}
