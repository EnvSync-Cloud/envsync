import { api } from "@/api";
import {
  ChevronsLeftRightEllipsis,
  DollarSign,
  Eye,
  KeyRound,
  LockKeyhole,
  Pencil,
  Plus,
  ScrollText,
  ShieldCheck,
  Webhook,
} from "lucide-react";
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { cloneElement, useEffect, useMemo, useState } from "react";
import { getRandomHexCode } from "@/lib/utils";
import { CreateRoleRequest, UpdateRoleRequest } from "@envsync-cloud/envsync-ts-sdk";
import { Role } from "@/api/roles.api";
import { DialogClose } from "@radix-ui/react-dialog";
import { ColorSelector } from "./color-selector";
import { Checkbox } from "@/components/ui/checkbox";
import type { LucideIcon } from "lucide-react";

type PermissionKey =
  | "can_view"
  | "can_edit"
  | "is_admin"
  | "have_api_access"
  | "have_webhook_access"
  | "have_billing_options"
  | "have_gpg_access"
  | "have_cert_access"
  | "have_audit_access";

interface PermissionDef {
  key: PermissionKey;
  label: string;
  icon: LucideIcon;
  description: string;
}

const PERMISSION_GROUPS: { label: string; permissions: PermissionDef[] }[] = [
  {
    label: "Core Access",
    permissions: [
      { key: "can_view", label: "View", icon: Eye, description: "Can view resources" },
      { key: "can_edit", label: "Edit", icon: Pencil, description: "Can edit resources" },
      { key: "is_admin", label: "Admin", icon: LockKeyhole, description: "Full admin access" },
    ],
  },
  {
    label: "Features",
    permissions: [
      { key: "have_api_access", label: "API Keys", icon: ChevronsLeftRightEllipsis, description: "Can manage API keys" },
      { key: "have_webhook_access", label: "Webhooks", icon: Webhook, description: "Can manage webhooks" },
      { key: "have_billing_options", label: "Billing", icon: DollarSign, description: "Can access billing" },
    ],
  },
  {
    label: "Security",
    permissions: [
      { key: "have_gpg_access", label: "GPG Keys", icon: KeyRound, description: "Can manage GPG keys" },
      { key: "have_cert_access", label: "Certificates", icon: ShieldCheck, description: "Can manage certificates" },
      { key: "have_audit_access", label: "Audit Logs", icon: ScrollText, description: "Can view audit logs" },
    ],
  },
];

const featureToPermissionKey: Record<string, PermissionKey> = {
  api: "have_api_access",
  webhook: "have_webhook_access",
  billing: "have_billing_options",
  gpg: "have_gpg_access",
  certificates: "have_cert_access",
  audit: "have_audit_access",
};

function prefillsToPermissions(prefills?: Partial<Role>): Record<PermissionKey, boolean> {
  const perms: Record<PermissionKey, boolean> = {
    can_view: false,
    can_edit: false,
    is_admin: false,
    have_api_access: false,
    have_webhook_access: false,
    have_billing_options: false,
    have_gpg_access: false,
    have_cert_access: false,
    have_audit_access: false,
  };

  if (!prefills) return perms;

  // Map access level to core permissions
  if (prefills.accessLevel === "admin") {
    perms.is_admin = true;
    perms.can_edit = true;
    perms.can_view = true;
  } else if (prefills.accessLevel === "editor") {
    perms.can_edit = true;
    perms.can_view = true;
  } else if (prefills.accessLevel === "viewer") {
    perms.can_view = true;
  }

  // Map features to permission keys
  if (prefills.features) {
    for (const feature of prefills.features) {
      const key = featureToPermissionKey[feature];
      if (key) perms[key] = true;
    }
  }

  return perms;
}

export const RoleEditForm = ({
  prefills,
  edit = false,
  children,
  disabled,
}: {
  prefills?: Partial<Role>;
  edit?: boolean;
  children?: JSX.Element;
  disabled?: boolean;
} = {}) => {
  const [name, setRoleName] = useState(prefills?.name || "");
  const [color, setColor] = useState(prefills?.color || getRandomHexCode);
  const [permissions, setPermissions] = useState<Record<PermissionKey, boolean>>(
    () => prefillsToPermissions(prefills)
  );
  const [open, setOpen] = useState(false);

  // Sync form state from prefills when dialog opens in edit mode
  useEffect(() => {
    if (open && edit && prefills) {
      setRoleName(prefills.name || "");
      setColor(prefills.color || getRandomHexCode());
      setPermissions(prefillsToPermissions(prefills));
    }
  }, [open, edit, prefills]);

  const unsavedChanges = useMemo(() => {
    if (!edit) return false;
    const original = prefillsToPermissions(prefills);
    const permsChanged = (Object.keys(permissions) as PermissionKey[]).some(
      (k) => permissions[k] !== original[k]
    );
    return (
      name !== prefills?.name ||
      color !== prefills?.color ||
      permsChanged
    );
  }, [edit, name, color, permissions, prefills]);

  const createRoleMutation = api.roles.createRole();
  const updateRoleMutation = api.roles.updateRole();

  const generatePayload = (): CreateRoleRequest | UpdateRoleRequest => {
    return {
      name,
      color,
      can_edit: permissions.can_edit,
      can_view: permissions.can_view,
      is_admin: permissions.is_admin,
      have_api_access: permissions.have_api_access,
      have_webhook_access: permissions.have_webhook_access,
      have_billing_options: permissions.have_billing_options,
      have_gpg_access: permissions.have_gpg_access,
      have_cert_access: permissions.have_cert_access,
      have_audit_access: permissions.have_audit_access,
    } as CreateRoleRequest | UpdateRoleRequest;
  };

  const handleResetForm = () => {
    setRoleName("");
    setColor(getRandomHexCode());
    setPermissions(prefillsToPermissions());
  };

  const handleCreateRole = () => {
    const payload = generatePayload();

    createRoleMutation.mutate(payload as CreateRoleRequest, {
      onSuccess: () => {
        handleResetForm();
        setOpen(false);
      },
    });
  };

  const handleUpdateRole = () => {
    const payload = generatePayload();

    updateRoleMutation.mutate(
      { role_id: prefills!.id || "", payload: payload as UpdateRoleRequest },
      {
        onSuccess: () => {
          setOpen(false);
        },
      }
    );
  };

  const togglePermission = (key: PermissionKey) => {
    setPermissions((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {children ? (
          cloneElement(children, {
            disabled: disabled || createRoleMutation.isPending,
          })
        ) : (
          <Button
            className="bg-violet-500 hover:bg-violet-600 text-white"
            disabled={createRoleMutation.isPending}
          >
            <Plus className="size-4 mr-2" />
            Create Role
          </Button>
        )}
      </DialogTrigger>
      <DialogContent hideCloseButton className="bg-gray-800 border-gray-700 max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-white">
            {edit ? "Edit Role" : "Create New Role"}
          </DialogTitle>
          <DialogDescription className="text-gray-400">
            Roles define sets of permissions that can be assigned to users.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-2 flex gap-2">
            <div className="space-y-2 w-full">
              <Label className="text-white" htmlFor="role-name">
                Name *
              </Label>
              <Input
                placeholder="Enter role name"
                id="role-name"
                value={name}
                onChange={(e) => setRoleName(e.target.value)}
                className="bg-gray-900"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-white" htmlFor="access-level">
                Color
              </Label>
              <ColorSelector color={color} setColor={setColor} />
            </div>
          </div>

          <div className="space-y-3">
            <Label className="text-white">Permissions</Label>
            {PERMISSION_GROUPS.map((group) => (
              <div key={group.label} className="space-y-2">
                <p className="text-xs font-medium text-gray-400 uppercase tracking-wider">
                  {group.label}
                </p>
                <div className="grid grid-cols-3 gap-2">
                  {group.permissions.map((perm) => {
                    const Icon = perm.icon;
                    const isChecked = permissions[perm.key];
                    const isInherited =
                      perm.key !== "is_admin" &&
                      perm.key !== "can_view" &&
                      perm.key !== "can_edit" &&
                      permissions.is_admin;

                    return (
                      <label
                        key={perm.key}
                        className={`flex items-center gap-2 rounded-md border px-3 py-2 cursor-pointer transition-colors ${
                          isChecked
                            ? "border-violet-500 bg-violet-500/10"
                            : "border-gray-700 bg-gray-900 hover:border-gray-600"
                        }`}
                      >
                        <Checkbox
                          checked={isChecked || isInherited}
                          onCheckedChange={() => togglePermission(perm.key)}
                          className="border-gray-600 data-[state=checked]:bg-violet-500 data-[state=checked]:border-violet-500"
                        />
                        <Icon size={14} className="text-gray-400 shrink-0" />
                        <span className="text-sm text-white truncate">
                          {perm.label}
                        </span>
                      </label>
                    );
                  })}
                </div>
              </div>
            ))}
            {permissions.is_admin && (
              <p className="text-xs text-violet-400">
                Admin inherits all management permissions via FGA.
              </p>
            )}
          </div>
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button
              variant="outline"
              className="text-white border-gray-600 hover:bg-gray-700"
            >
              Close
            </Button>
          </DialogClose>
          {edit ? (
            <Button
              onClick={handleUpdateRole}
              className="bg-violet-500 hover:bg-violet-600 text-white"
              disabled={!unsavedChanges || updateRoleMutation.isPending}
            >
              Update
            </Button>
          ) : (
            <Button
              onClick={handleCreateRole}
              className="bg-violet-500 hover:bg-violet-600 text-white"
              disabled={!name || createRoleMutation.isPending}
            >
              Create
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
