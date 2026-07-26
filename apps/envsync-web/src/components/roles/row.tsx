import { formatLastUsed, generateColorShades, isLightColor } from "@/lib/utils";
import { Button } from "../ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "../ui/dialog";
import { AvatarGroup } from "../ui/avatar-group";
import { Tooltip, TooltipContent, TooltipTrigger } from "../ui/tooltip";
import { RoleData } from "@/hooks/useRoles";
import {
  AlertTriangle,
  ChevronsLeftRightEllipsis,
  Code,
  Crown,
  DollarSign,
  Eye,
  LockKeyhole,
  Pencil,
  Shield,
  Star,
  User2,
  Webhook,
  X,
} from "lucide-react";
import { api } from "@/api";
import { Role } from "@/api/roles.api";
import { RoleEditForm } from "./edit-form";

const accessLevelIcon: Record<
  "none" | "viewer" | "editor" | "admin",
  React.ReactNode
> = {
  none: <X className="inline mr-2" size={16} />,
  viewer: <Eye className="inline mr-2" size={16} />,
  editor: <Pencil className="inline mr-2" size={16} />,
  admin: <LockKeyhole className="inline mr-2" size={16} />,
};

const featuresIcons: Record<string, React.ReactNode> = {
  api: <ChevronsLeftRightEllipsis className="inline mr-1" size={12} />,
  webhook: <Webhook className="inline mr-1" size={12} />,
  billing: <DollarSign className="inline mr-1" size={12} />,
};

const getRoleIcon = (role: Role) => {
  if (role.isMaster) return Crown;
  if (role.accessLevel === "admin" && role.features.length === 3) return Crown;
  if (role.features.includes("billing")) return DollarSign;
  if (role.accessLevel === "admin") return Shield;
  if (role.accessLevel === "editor") return Code;
  if (role.accessLevel === "viewer") return Eye;
  return User2;
};

const getLogo = (role: Role) => {
  const Icon = getRoleIcon(role);
  const isLight = isLightColor(role.color);
  const { light, dark } = generateColorShades(role.color, 60);

  return (
    <div
      style={{
        backgroundColor: role.color,
        color: isLight ? dark : light,
        borderWidth: role.isMaster ? 1 : 0,
        borderStyle: "solid",
        borderColor: (isLight ? dark : light) + "66",
      }}
      className="size-8 rounded-md shadow bg-muted flex items-center justify-center"
    >
      {<Icon className="size-4 text-inherit" />}
    </div>
  );
};

interface RoleRowProps {
  role: RoleData;
}

export const RoleRow = ({ role }: RoleRowProps) => {
  const deleteRole = api.roles.deleteRole();

  return (
    <tr key={role.id} className="border-b border-border hover:bg-muted/50 transition-colors">
      <td className="p-4">
        <div className="flex items-center justify-between">
          <span className="font-medium flex gap-2 items-center text-foreground">
            {getLogo(role)}
            {role.name || "Untitled"}
            {role.isMaster && (
              <Tooltip>
                <TooltipTrigger>
                  <Star size={16} className="fill-yellow-300/60" />
                </TooltipTrigger>
                <TooltipContent>
                  This is the master role and can not be modified.
                </TooltipContent>
              </Tooltip>
            )}
          </span>
        </div>
      </td>
      <td className="p-4">
        <span className="text-sm text-muted-foreground">
          {accessLevelIcon[role.accessLevel]}
          {role.accessLevel.toUpperCase()}
        </span>
      </td>
      <td className="p-4">
        <div className="flex items-center flex-wrap gap-1">
          {role.features.length > 0 ? (
            role.features.map((feature) => (
              <span
                key={feature}
                className={`text-xs flex-nowrap flex items-center px-2 py-1 rounded ${
                  feature === "billing"
                    ? "bg-green-900 text-green-300"
                    : feature === "webhook"
                    ? "bg-emerald-300 text-emerald-900"
                    : feature === "api"
                    ? "bg-yellow-900 text-yellow-300"
                    : "bg-muted text-muted-foreground"
                }`}
              >
                {featuresIcons[feature] || null}
                {feature.toUpperCase()}
              </span>
            ))
          ) : (
            <span className="text-sm text-muted-foreground">No features assigned</span>
          )}
        </div>
      </td>
      <td className="p-4">
        <div className="space-y-2">
          {role.users.length > 0 ? (
            <AvatarGroup
              items={role.users.map((user) => ({
                name: user.full_name,
                avatar: user.profile_picture_url,
              }))}
              show={3}
              className="max-w-[200px]"
            />
          ) : (
            <span className="text-sm text-muted-foreground">No users assigned</span>
          )}
          {role.teamCount > 0 && (
            <span className="inline-flex rounded-full bg-blue-500/10 px-2 py-1 text-xs text-blue-300">
              {role.teamCount} team{role.teamCount > 1 ? "s" : ""}
            </span>
          )}
        </div>
      </td>
      <td className="p-4">
        <span className="text-sm text-muted-foreground">
          {formatLastUsed(new Date(role.createdAt))}
        </span>
      </td>
      <td className="p-4 text-right">
        <div className="flex items-center justify-end space-x-2">
          <RoleEditForm prefills={role} edit disabled={role.isMaster}>
            <Button
              variant="outline"
              size="sm"
              className="text-foreground border-border hover:bg-muted"
            >
              <Pencil className="size-3" />
            </Button>
          </RoleEditForm>

          {/* <Button
                          variant="outline"
                          size="sm"
                          className="text-foreground border-border hover:bg-muted"
                        >
                          <UserPlus2 className="size-3" />
                        </Button> */}
          <Dialog>
            <DialogTrigger asChild>
              <Button
                disabled={role.isMaster}
                variant="outline"
                size="sm"
                className="text-red-400 border-red-600 hover:bg-red-900/20 hover:text-red-300"
              >
                <X className="size-3" />
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-muted border-border">
              <DialogHeader>
                <DialogTitle className="text-foreground flex items-center gap-2">
                  <AlertTriangle className="text-red-400" size={20} /> Delete
                  Role
                </DialogTitle>
                <DialogDescription className="text-muted-foreground">
                  Are you sure you want to delete the role{" "}
                  <span className="font-medium">
                    {role.name || "Untitled"}
                  </span>
                  ? This action cannot be undone.
                </DialogDescription>
              </DialogHeader>
              {(role.users.length > 0 || role.teamCount > 0) && (
                <p className="text-red-400 bg-card p-2 border border-red-400/40 rounded-md text-sm">
                  Note: This role cannot be deleted while it is assigned to{" "}
                  {role.users.length} user(s) and {role.teamCount} team(s).
                </p>
              )}
              <DialogFooter>
                <DialogClose asChild>
                  <Button
                    variant="outline"
                    className="text-foreground border-border hover:bg-muted"
                  >
                    Cancel
                  </Button>
                </DialogClose>
                <Button
                  variant="destructive"
                  onClick={() => deleteRole.mutate(role.id)}
                  disabled={deleteRole.isPending || role.users.length > 0 || role.teamCount > 0}
                >
                  Delete
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </td>
    </tr>
  );
};
