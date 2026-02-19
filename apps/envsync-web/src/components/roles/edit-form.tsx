import { api } from "@/api";
import {
  ChevronsLeftRightEllipsis,
  DollarSign,
  Eye,
  LockKeyhole,
  Pencil,
  Plus,
  Webhook,
  X,
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
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { cloneElement, useMemo, useState } from "react";
import { MultiSelect } from "@/components/ui/multi-select";
import { getRandomHexCode } from "@/lib/utils";
import { CreateRoleRequest } from "@envsync-cloud/envsync-ts-sdk";
import { Role } from "@/api/roles.api";
import { DialogClose } from "@radix-ui/react-dialog";
import { ColorSelector } from "./color-selector";

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
  const [accessLevel, setAccessLevel] = useState<string>(
    prefills?.accessLevel || "none"
  );
  const [color, setColor] = useState(prefills?.color || getRandomHexCode);
  const [features, setFeatures] = useState<string[]>(prefills?.features || []);
  const [open, setOpen] = useState(false);

  const unsavedChanges = useMemo(() => {
    if (!edit) return false;
    return (
      name !== prefills?.name ||
      accessLevel !== prefills?.accessLevel ||
      color !== prefills?.color ||
      features.join(",") !== prefills?.features?.join(",")
    );
  }, [
    edit,
    name,
    accessLevel,
    color,
    features,
    prefills?.name,
    prefills?.accessLevel,
    prefills?.color,
    prefills?.features,
  ]);

  const roles = api.roles.getAllRoles();
  const createRoleMutation = api.roles.createRole();
  const updateRoleMutation = api.roles.updateRole();

  const generatePayload = () => {
    const payload: CreateRoleRequest = {
      name,
      color,
      can_edit: false,
      can_view: false,
      is_admin: false,
      have_api_access: features.includes("api"),
      have_webhook_access: features.includes("webhook"),
      have_billing_options: features.includes("billing"),
    };

    if (accessLevel === "admin") {
      payload.is_admin = true;
      payload.can_edit = true;
      payload.can_view = true;
    } else if (accessLevel === "editor") {
      payload.can_edit = true;
      payload.can_view = true;
    } else if (accessLevel === "viewer") {
      payload.can_view = true;
    }

    return payload;
  };

  const handleResetForm = () => {
    setRoleName("");
    setAccessLevel("none");
    setColor(getRandomHexCode());
    setFeatures([]);
  };

  const handleCreateRole = () => {
    const payload = generatePayload();

    createRoleMutation.mutate(payload, {
      onSuccess: () => {
        handleResetForm();
        roles.refetch();
        setOpen(false);
      },
    });
  };

  const handleUpdateRole = () => {
    const payload = generatePayload();

    updateRoleMutation.mutate(
      { role_id: prefills.id || "", ...payload },
      {
        onSuccess: () => {
          handleResetForm();
          roles.refetch();
          setOpen(false);
        },
      }
    );
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
      <DialogContent hideCloseButton className="bg-gray-800 border-gray-700">
        <DialogHeader>
          <DialogTitle className="text-white">
            {edit ? "Edit Role" : "Create New Role"}
          </DialogTitle>
          <DialogDescription className="text-gray-400">
            Roles define sets of permissions that can be assigned to users.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
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
          <div className="space-2 flex gap-2">
            <div className="space-y-2 w-full">
              <Label className="text-white" htmlFor="access-level">
                Access Level *
              </Label>
              <Select value={accessLevel} onValueChange={setAccessLevel}>
                <SelectTrigger className="w-full bg-gray-900 border-gray-700 text-white">
                  <SelectValue placeholder="Select access level" />
                </SelectTrigger>
                <SelectContent className="bg-gray-900 border-gray-700">
                  <SelectItem
                    value="none"
                    className="text-white hover:bg-gray-700"
                  >
                    <X className="inline mr-2" size={16} />
                    None
                  </SelectItem>
                  <SelectItem
                    value="viewer"
                    className="text-white hover:bg-gray-700"
                  >
                    <Eye className="inline mr-2" size={16} />
                    View
                  </SelectItem>
                  <SelectItem
                    value="editor"
                    className="text-white hover:bg-gray-700"
                  >
                    <Pencil className="inline mr-2" size={16} />
                    Edit
                  </SelectItem>
                  <SelectItem
                    value="admin"
                    className="text-white hover:bg-gray-700"
                  >
                    <LockKeyhole className="inline mr-2" size={16} />
                    Admin
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2 w-full">
              <Label className="text-white" htmlFor="access-level">
                Color
              </Label>
              <ColorSelector color={color} setColor={setColor} />
            </div>
          </div>
          <div className="space-y-2 w-full">
            <Label className="text-white" htmlFor="description">
              Features
            </Label>
            <MultiSelect
              items={[
                {
                  label: (
                    <h1 className="flex items-center gap-1">
                      <ChevronsLeftRightEllipsis size={16} /> API
                    </h1>
                  ),
                  value: "api",
                },
                {
                  label: (
                    <h1 className="flex items-center gap-1">
                      <Webhook size={16} /> Webhook
                    </h1>
                  ),
                  value: "webhook",
                },
                {
                  label: (
                    <h1 className="flex items-center gap-1">
                      <DollarSign size={16} /> Billing
                    </h1>
                  ),
                  value: "billing",
                },
              ]}
              value={features}
              onChange={setFeatures}
              placeholder="Select features"
              className="bg-gray-900 min-h-10 size-full rounded-md border border-gray-800 hover:bg-gray-900 text-white font-mono flex items-center justify-start p-2"
            />
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
