import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Database,
  Calendar,
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
  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    }).format(date);
  };

  const getRelativeTime = (date: Date) => {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return "Today";
    if (diffDays === 1) return "Yesterday";
    if (diffDays < 7) return `${diffDays} days ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
    return formatDate(date);
  };

  return (
    <Card className="bg-slate-800 border-slate-700 hover:border-slate-600 transition-all duration-200 group cursor-pointer">
      <CardHeader className="pb-3">
        <div
          onClick={() => onView(app)}
          className="flex items-start justify-between"
        >
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-gradient-to-br from-emerald-400 to-blue-400 rounded-lg flex items-center justify-center shadow-lg shadow-emerald-500/20">
              <Database className="w-5 h-5 text-white" />
            </div>
            <div>
              <CardTitle className="text-white text-lg font-semibold group-hover:text-emerald-400 transition-colors">
                {app.name}
              </CardTitle>
              <div className="flex items-center space-x-2 mt-1">
                <Badge
                  variant="secondary"
                  className={`text-xs ${
                    app.status === "active"
                      ? "bg-emerald-500/20 text-emerald-400"
                      : "bg-slate-600 text-slate-300"
                  }`}
                >
                  {app.status || "active"}
                </Badge>
              </div>
            </div>
          </div>

          {canEdit && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-slate-400 hover:text-white hover:bg-slate-700 opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={(e) => e.stopPropagation()}
                >
                  <MoreHorizontal className="w-4 h-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                className="bg-slate-800 border-slate-700"
                align="end"
              >
                <DropdownMenuItem
                  className="text-white hover:bg-slate-700 cursor-pointer"
                  onClick={(e) => {
                    e.stopPropagation();
                    onView(app);
                  }}
                >
                  <Eye className="w-4 h-4 mr-2" />
                  View Details
                </DropdownMenuItem>
                <DropdownMenuItem
                  className="text-white hover:bg-slate-700 cursor-pointer"
                  onClick={(e) => {
                    e.stopPropagation();
                    onEdit(app);
                  }}
                >
                  <Edit className="w-4 h-4 mr-2" />
                  Edit Project
                </DropdownMenuItem>
                <DropdownMenuItem
                  className="text-red-400 hover:bg-slate-700 cursor-pointer"
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

      <CardContent className="pt-0" onClick={() => onView(app)}>
        <p className="text-slate-400 text-sm mb-4 line-clamp-2">
          {app.description || "No description provided"}
        </p>

        <div className="flex items-center justify-between text-sm">
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-1 text-slate-400">
              <Key className="w-3 h-3" />
              <span>{app.env_count || 0} vars</span>
            </div>
            {app.enable_secrets && (
              <div className="flex items-center space-x-1 text-slate-400">
                <Shield className="w-3 h-3" />
                <span>{app.secret_count || 0} secrets</span>
              </div>
            )}
          </div>

          <div className="flex items-center space-x-1 text-slate-400">
            <Calendar className="w-3 h-3" />
            <span>{getRelativeTime(app.updated_at)}</span>
          </div>
        </div>

        <div className="mt-4 pt-4 border-t border-slate-700">
          <Button
            onClick={(e) => {
              e.stopPropagation();
              navigate(`/applications/${app.id}`);
            }}
            className="w-full bg-slate-700 hover:bg-slate-600 text-white"
            size="sm"
          >
            <Eye className="w-4 h-4 mr-2" />
            View Project
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};
