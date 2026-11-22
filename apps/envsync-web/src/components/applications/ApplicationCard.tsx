import { Button } from "@/components/ui/button";
import { MoreHorizontal, Eye, Edit, Trash2 } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { TableCell, TableRow } from "@/components/ui/table";
import { App } from "@/constants";
import { useNavigate } from "react-router-dom";
import { appDetailPath } from "@/lib/app-routes";

interface ApplicationCardProps {
  app: App;
  canEdit: boolean;
  onView: (app: App) => void;
  onEdit: (app: App) => void;
  onDelete: (app: App) => void;
}

export const ApplicationCard = ({
  app,
  canEdit,
  onView,
  onEdit,
  onDelete,
}: ApplicationCardProps) => {
  const navigate = useNavigate();

  const getRelativeTime = (date: Date) => {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffMins = Math.floor(diffMs / (1000 * 60));

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays === 1) return "Yesterday";
    if (diffDays < 7) return `${diffDays}d ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`;
    return new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
    }).format(date);
  };

  return (
    <TableRow
      className="cursor-pointer border-border"
      onClick={() => navigate(appDetailPath(app.id))}
    >
      <TableCell className="max-w-[28rem]">
        <p className="truncate text-sm font-medium text-foreground">{app.name}</p>
        <p className="truncate text-xs text-muted-foreground">
          {app.description || "No description"}
        </p>
      </TableCell>
      <TableCell className="text-right tabular-nums text-foreground">
        {app.env_count ?? 0}
      </TableCell>
      <TableCell className={`text-right tabular-nums ${app.enable_secrets ? "text-foreground" : "text-muted-foreground"}`}>
        {app.enable_secrets ? app.secret_count ?? 0 : "Off"}
      </TableCell>
      <TableCell className="whitespace-nowrap text-muted-foreground">
        {getRelativeTime(app.updated_at)}
      </TableCell>
      {canEdit && (
        <TableCell className="text-right" onClick={(event) => event.stopPropagation()}>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="size-8 text-muted-foreground hover:bg-muted hover:text-foreground"
                aria-label="Application actions"
              >
                <MoreHorizontal className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem className="cursor-pointer" onClick={() => onView(app)}>
                <Eye className="mr-2 size-4" />
                View Details
              </DropdownMenuItem>
              <DropdownMenuItem className="cursor-pointer" onClick={() => onEdit(app)}>
                <Edit className="mr-2 size-4" />
                Edit Project
              </DropdownMenuItem>
              <DropdownMenuItem
                className="cursor-pointer text-red-400 focus:bg-red-500/10 focus:text-red-400"
                onClick={() => onDelete(app)}
              >
                <Trash2 className="mr-2 size-4" />
                Delete Project
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </TableCell>
      )}
    </TableRow>
  );
};
