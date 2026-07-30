import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { formatDate, formatLastUsed } from "@/lib/utils";
import {
  Mail,
  MoreHorizontal,
  Shield,
  AlertTriangle,
  Crown,
  DollarSign,
  Code,
  Eye,
} from "lucide-react";
import { Avatar, AvatarImage, AvatarFallback } from "../ui/avatar";
import { Skeleton } from "../ui/skeleton";

interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  roleId: string;
  status: string;
  lastSeen: string;
  avatar: string;
}

interface UserRowProps {
  user: User;
  isLoading: boolean;
  canManageUsers: boolean;
  onEditRole: (user: User) => void;
  onDeleteUser: (user: User) => void;
}

export const UserRow = ({
  user,
  isLoading,
  canManageUsers,
  onEditRole,
  onDeleteUser,
}: UserRowProps) => {
  const getRoleIcon = (role: string) => {
    const roleLower = role.toLowerCase();

    if (roleLower.includes("org")) {
      return <Crown className="size-3" />;
    } else if (roleLower.includes("billing")) {
      return <DollarSign className="size-3" />;
    } else if (roleLower.includes("admin")) {
      return <Crown className="size-3" />;
    } else if (
      roleLower.includes("developer") ||
      roleLower.includes("dev") ||
      roleLower.includes("engineer")
    ) {
      return <Code className="size-3" />;
    } else if (roleLower.includes("manager") || roleLower.includes("lead")) {
      return <Shield className="size-3" />;
    } else {
      return <Eye className="size-3" />;
    }
  };

  const getRoleBadgeColor = (role: string) => {
    const roleLower = role.toLowerCase();

    if (roleLower.includes("org")) {
      return "bg-red-100 text-red-700 border-red-200 dark:bg-red-900 dark:text-red-300 dark:border-red-800 hover:bg-red-700 hover:text-red-100 hover:border-red-500 select-all";
    } else if (roleLower.includes("billing")) {
      return "bg-yellow-100 text-yellow-700 border-yellow-200 dark:bg-yellow-900 dark:text-yellow-300 dark:border-yellow-800 hover:bg-yellow-700 hover:text-yellow-100 hover:border-yellow-500 select-all";
    } else if (roleLower.includes("admin")) {
      return "bg-teal-100 text-teal-700 border-teal-200 dark:bg-teal-900 dark:text-teal-300 dark:border-teal-800 hover:bg-teal-700 hover:text-teal-100 hover:border-teal-500 select-all";
    } else if (
      roleLower.includes("developer") ||
      roleLower.includes("dev") ||
      roleLower.includes("engineer")
    ) {
      return "bg-teal-100 text-teal-700 border-teal-200 dark:bg-teal-900 dark:text-teal-300 dark:border-teal-800 hover:bg-teal-700 hover:text-teal-100 hover:border-teal-500 select-all";
    } else if (roleLower.includes("manager") || roleLower.includes("lead")) {
      return "bg-green-100 text-green-700 border-green-200 dark:bg-green-900 dark:text-green-300 dark:border-green-800 hover:bg-green-700 hover:text-green-100 hover:border-green-500 select-all";
    } else {
      return "bg-muted text-muted-foreground border-border hover:bg-zinc-600 hover:text-foreground hover:border-zinc-500 select-all";
    }
  };

  const getStatusBadgeColor = (status: string) => {
    switch (status) {
      case "active":
        return "bg-green-100 text-green-700 border-green-200 dark:bg-green-900 dark:text-green-300 dark:border-green-800 hover:bg-green-700 hover:text-green-100 hover:border-green-600";
      case "pending":
        return "bg-yellow-100 text-yellow-700 border-yellow-200 dark:bg-yellow-900 dark:text-yellow-300 dark:border-yellow-800 hover:bg-yellow-700 hover:text-yellow-100 hover:border-yellow-600";
      case "inactive":
        return "bg-muted text-muted-foreground border-border hover:bg-zinc-600 hover:text-foreground hover:border-zinc-500";
      default:
        return "bg-muted text-muted-foreground border-border hover:bg-zinc-600 hover:text-foreground hover:border-zinc-500";
    }
  };

  return (
    <tr className="border-b rounded-xl border-border hover:bg-muted/50 transition-colors">
      <td className="py-4 px-4">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-muted rounded-lg flex items-center justify-center overflow-hidden">
            {user.avatar ? (
              <Avatar className="w-full h-full rounded-none overflow-hidden">
                <AvatarImage
                  src={user.avatar}
                  alt={`${user.name} profile`}
                  className="w-full h-full object-cover"
                />
                <AvatarFallback className="bg-inherit text-foreground">
                  {user.name
                    .split(" ")
                    .map((n) => n[0])
                    .join("")
                    .toUpperCase()}
                </AvatarFallback>
              </Avatar>
            ) : (
              <span className="text-foreground text-sm font-medium">
                {user.name
                  .split(" ")
                  .map((n) => n[0])
                  .join("")
                  .toUpperCase()}
              </span>
            )}
          </div>
          <div>
            <h3 className="font-medium text-foreground">{user.name}</h3>
            <div className="flex items-center space-x-1 text-sm text-muted-foreground">
              <Mail className="w-3 h-3" />
              <span className="hdx-mask">{user.email}</span>
            </div>
          </div>
        </div>
      </td>
      <td className="py-4 px-4">
        <Badge className={`${getRoleBadgeColor(user.role)} border`}>
          {getRoleIcon(user.role)}
          <span className="ml-1">{user.role}</span>
        </Badge>
      </td>
      <td className="py-4 px-4">
        <Badge className={`${getStatusBadgeColor(user.status)} border`}>
          {user.status}
        </Badge>
      </td>
      <td className="py-4 px-4">
        <span className="text-sm text-muted-foreground">
          {formatLastUsed(user.lastSeen)}
        </span>
        <span className="text-xs text-tertiary block">
          {formatDate(user.lastSeen)}
        </span>
      </td>
      {canManageUsers && (
        <td className="py-4 px-4 flex justify-end">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="text-muted-foreground hover:text-foreground hover:bg-muted"
                disabled={isLoading}
                aria-label="User actions"
              >
                {isLoading ? (
                  <div className="w-4 h-4 border-2 border-muted-foreground border-t-transparent rounded-full animate-spin" />
                ) : (
                  <MoreHorizontal className="w-4 h-4" />
                )}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="bg-muted border-border">
              <DropdownMenuItem
                className="text-foreground hover:bg-muted cursor-pointer"
                onClick={() => onEditRole(user)}
              >
                <Shield className="w-4 h-4 mr-2" />
                Edit Role
              </DropdownMenuItem>
              <DropdownMenuItem
                className="text-red-400 hover:bg-muted cursor-pointer"
                onClick={() => onDeleteUser(user)}
              >
                <AlertTriangle className="w-4 h-4 mr-2" />
                Remove User
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </td>
      )}
    </tr>
  );
};

export const UserRowSkeleton = () => (
  <tr className="border-b border-border">
    <td className="py-3 px-4">
      <div className="flex items-center space-x-3">
        <Skeleton className="h-9 w-9 rounded-full bg-muted" />
        <div className="space-y-2">
          <Skeleton className="h-4 w-28 bg-muted" />
          <Skeleton className="h-3 w-36 bg-muted/70" />
        </div>
      </div>
    </td>
    <td className="py-3 px-4">
      <Skeleton className="h-6 w-24 bg-muted" />
    </td>
    <td className="py-3 px-4">
      <Skeleton className="h-6 w-20 bg-muted rounded-full" />
    </td>
    <td className="py-3 px-4">
      <Skeleton className="h-4 w-24 bg-muted" />
    </td>
    <td className="py-3 px-4 text-right">
      <div className="flex justify-end gap-2">
        <Skeleton className="h-8 w-8 bg-muted rounded-md" />
        <Skeleton className="h-8 w-8 bg-muted rounded-md" />
      </div>
    </td>
  </tr>
);
