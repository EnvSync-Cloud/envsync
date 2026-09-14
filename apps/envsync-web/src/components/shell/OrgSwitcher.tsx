import { Check, ChevronsUpDown, Globe, Loader2, Plus, Sparkles } from "lucide-react";
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
  expanded: boolean;
}

export function OrgSwitcher({ expanded }: OrgSwitcherProps) {
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
      ?? memberships.find((membership) => membership.is_active)
      ?? null,
    [activeMembershipUserId, memberships],
  );
  const activeOrgName = activeMembership?.org_name || user?.org?.name || "EnvSync Workspace";
  const activeRole = activeMembership?.role_name || user?.role?.name || "Member";
  const canSwitchOrganizations =
    runtimeConfig.edition === "enterprise" && user?.auth_type !== "saml";
  const canCreateOrganization = canCreateOrganizationInUi(runtimeConfig);

  if (!canSwitchOrganizations) {
    return (
      <div
        className={cn(
          "flex items-center rounded-2xl border border-primary/20 bg-primary/10 text-primary",
          expanded ? "gap-2 px-3 py-2" : "justify-center p-2",
        )}
        title={activeOrgName}
      >
        <Sparkles className="size-3.5 shrink-0" />
        {expanded && <span className="truncate text-sm font-medium">{activeOrgName}</span>}
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
              "flex w-full items-center rounded-2xl border border-primary/20 bg-primary/10 text-left text-primary transition-colors hover:border-primary/30 hover:bg-primary/14",
              expanded ? "gap-2 px-3 py-2" : "justify-center p-2",
            )}
            title={activeOrgName}
          >
            <span className="inline-flex size-6 shrink-0 items-center justify-center rounded-full border border-primary/20 bg-primary/15">
              {isSwitchingOrg || isCreatingOrganization ? (
                <Loader2 className="size-3 animate-spin" />
              ) : (
                <Sparkles className="size-3" />
              )}
            </span>
            {expanded && (
              <>
                <span className="min-w-0 flex-1 truncate text-sm font-medium">{activeOrgName}</span>
                <ChevronsUpDown className="size-3.5 shrink-0 text-primary/70" />
              </>
            )}
          </button>
        </PopoverTrigger>
        <PopoverContent align="start" side="right" className="w-[320px] border-border bg-popover p-0">
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
                        setOpen(false);
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
                        setOpen(false);
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
      <CreateOrganizationDialog
        open={createOrganizationOpen}
        onOpenChange={setCreateOrganizationOpen}
      />
    </>
  );
}
