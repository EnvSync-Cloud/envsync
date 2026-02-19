import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  MoreHorizontal,
  Eye,
  Edit,
  Trash2,
  Key,
  Shield,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { App } from "@/constants";
import { useNavigate } from "react-router-dom";

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
    <Card className="bg-card text-card-foreground bg-gradient-to-br from-gray-900 to-gray-950 border-gray-800 shadow-xl hover:border-gray-700 transition-all duration-200 group cursor-pointer hover:shadow-lg hover:shadow-violet-500/5 hover:-translate-y-0.5">
      <CardHeader className="pb-3">
        <div
          onClick={() => navigate(`/applications/${app.id}`)}
          className="flex items-start justify-between"
        >
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-gradient-to-br from-violet-500/20 to-indigo-500/20 rounded-lg flex items-center justify-center">
              <span className="text-lg font-semibold text-violet-400">
                {app.name.charAt(0).toUpperCase()}
              </span>
            </div>
            <div>
              <CardTitle className="text-gray-100 text-base font-semibold group-hover:text-white transition-colors">
                {app.name}
              </CardTitle>
            </div>
          </div>

          {canEdit && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-gray-500 hover:text-gray-200 hover:bg-gray-800 opacity-0 group-hover:opacity-100 transition-all h-8 w-8"
                  onClick={(e) => e.stopPropagation()}
                >
                  <MoreHorizontal className="w-4 h-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                className="bg-gray-900 border-gray-800"
                align="end"
              >
                <DropdownMenuItem
                  className="text-gray-300 focus:bg-gray-800 focus:text-gray-100 cursor-pointer"
                  onClick={(e) => {
                    e.stopPropagation();
                    onView(app);
                  }}
                >
                  <Eye className="w-4 h-4 mr-2" />
                  View Details
                </DropdownMenuItem>
                <DropdownMenuItem
                  className="text-gray-300 focus:bg-gray-800 focus:text-gray-100 cursor-pointer"
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
        </div>
      </CardHeader>

      <CardContent
        className="pt-0"
        onClick={() => navigate(`/applications/${app.name}-${app.id}`)}
      >
        <p className="text-gray-500 text-sm mb-4 line-clamp-2">
          {app.description || "No description provided"}
        </p>

        <div className="flex items-center justify-between text-xs">
          <div className="flex items-center space-x-3">
            <div className="flex items-center space-x-1.5 text-gray-400">
              <Key className="w-3 h-3" />
              <span>{app.env_count || 0} vars</span>
            </div>
            {app.enable_secrets && (
              <div className="flex items-center space-x-1.5 text-gray-400">
                <Shield className="w-3 h-3" />
                <span>{app.secret_count || 0} secrets</span>
              </div>
            )}
          </div>

          <span className="text-gray-500">
            {getRelativeTime(app.updated_at)}
          </span>
        </div>
      </CardContent>
    </Card>
  );
};
