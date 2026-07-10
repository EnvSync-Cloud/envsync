import { Button } from "@/components/ui/button";
import { MoreHorizontal, Eye, Edit, Trash2, ChevronRight, Database } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
  const configItemCount = (app.env_count ?? 0) + (app.secret_count ?? 0);

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
    <div
      className="flex items-center justify-between px-4 py-3 hover:bg-zinc-800/50 transition-colors border-b border-zinc-800/50 cursor-pointer group"
      onClick={() => navigate(appDetailPath(app.id))}
    >
      <div className="flex items-center gap-3 min-w-0">
        <div className="size-9 rounded-lg bg-zinc-800 border border-zinc-700/50 flex items-center justify-center flex-shrink-0">
          <Database className="size-4 text-emerald-400" />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-medium text-zinc-200 group-hover:text-white transition-colors truncate">
            {app.name}
          </p>
          <p className="text-xs text-zinc-500 truncate">
            {app.description || "No description"} · {configItemCount} config items · Updated {getRelativeTime(app.updated_at)}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2 flex-shrink-0">
        {canEdit && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800 opacity-0 group-hover:opacity-100 transition-all h-8 w-8"
                onClick={(e) => e.stopPropagation()}
              >
                <MoreHorizontal className="w-4 h-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="bg-zinc-900 border-zinc-800" align="end">
              <DropdownMenuItem
                className="text-zinc-300 focus:bg-zinc-800 focus:text-zinc-100 cursor-pointer"
                onClick={(e) => {
                  e.stopPropagation();
                  onView(app);
                }}
              >
                <Eye className="w-4 h-4 mr-2" />
                View Details
              </DropdownMenuItem>
              <DropdownMenuItem
                className="text-zinc-300 focus:bg-zinc-800 focus:text-zinc-100 cursor-pointer"
                onClick={(e) => {
                  e.stopPropagation();
                  onEdit(app);
                }}
              >
                <Edit className="w-4 h-4 mr-2" />
                Edit Project
              </DropdownMenuItem>
              <DropdownMenuItem
                className="text-red-400 focus:bg-red-500/10 focus:text-red-400 cursor-pointer"
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete(app);
                }}
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Delete Project
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
        <ChevronRight className="size-4 text-zinc-600 group-hover:text-zinc-400 transition-colors" />
      </div>
    </div>
  );
};
