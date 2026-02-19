import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Database,
  Calendar,
  User,
  Globe,
  Key,
  Shield,
  Edit,
  ExternalLink,
  Copy,
  Info,
} from "lucide-react";
import { App } from "@/constants";
import { useCopy } from "@/hooks/useClipboard";
import { useNavigate } from "react-router-dom";

interface ViewAppModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  app: App | null;
  canEdit: boolean;
  onEdit: (app: App) => void;
}

export const ViewAppModal = ({
  open,
  onOpenChange,
  app,
  canEdit,
  onEdit,
}: ViewAppModalProps) => {
  const copy = useCopy();

  const navigate = useNavigate();

  if (!app) return null;

  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    }).format(date);
  };

  const handleCopyId = () => {
    copy.mutate(app.id);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-gray-900 border-gray-800 max-w-2xl">
        <DialogHeader>
          <div className="flex items-center space-x-3">
            <div className="w-12 h-12 bg-gradient-to-br from-violet-500/20 to-indigo-500/20 rounded-lg flex items-center justify-center">
              <Database className="w-6 h-6 text-white" />
            </div>
            <div>
              <DialogTitle className="text-white text-xl font-semibold">
                {app.name}
              </DialogTitle>
              <DialogDescription className="text-gray-400">
                Project Details and Configuration
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-6">
          {/* Status and Actions */}
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <Badge
                variant="secondary"
                className={`${
                  app.status === "active"
                    ? "bg-violet-500/10 text-violet-400 border-violet-500/30"
                    : "bg-gray-700 text-gray-300 border-gray-600"
                } border`}
              >
                {app.status || "active"}
              </Badge>
              <div className="flex items-center space-x-4 text-sm text-gray-400">
                <div className="flex items-center space-x-1">
                  <Key className="w-4 h-4" />
                  <span>{app.env_count || 0} variables</span>
                </div>
                {app.enable_secrets && (
                  <div className="flex items-center space-x-1">
                    <Shield className="w-4 h-4" />
                    <span>{app.secret_count || 0} secrets</span>
                  </div>
                )}
              </div>
            </div>
            {canEdit && (
              <Button
                onClick={() => onEdit(app)}
                className="bg-violet-500 hover:bg-violet-600 text-white"
                size="sm"
              >
                <Edit className="w-4 h-4 mr-2" />
                Edit Project
              </Button>
            )}
          </div>

          {/* Description */}
          <div className="space-y-2">
            <h4 className="text-white font-medium">Description</h4>
            <p className="text-gray-300 bg-gray-900 p-3 rounded-lg">
              {app.description || "No description provided"}
            </p>
          </div>

          {/* Project Information */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-4">
              <div className="space-y-2">
                <h4 className="text-white font-medium flex items-center">
                  <Database className="w-4 h-4 mr-2" />
                  Project ID
                </h4>
                <div className="flex items-center space-x-2">
                  <code className="text-sm select-all font-mono text-gray-300 bg-gray-900 px-3 py-2 rounded flex-1">
                    {app.id}
                  </code>
                  {/* <Button
                    size="sm"
                    variant="ghost"
                    className="text-gray-400 hover:text-white"
                    onClick={handleCopyId}
                  >
                    <Copy className="w-4 h-4" />
                  </Button> */}
                </div>
              </div>
            </div>

            <div className="space-y-4">
              {/* <div className="space-y-2">
                <h4 className="text-white font-medium flex items-center">
                  <User className="w-4 h-4 mr-2" />
                  Organization
                </h4>
                <p className="text-gray-300 bg-gray-900 p-3 rounded">
                  {app.org_id}
                </p>
              </div> */}
              <div className="space-y-2">
                <h4 className="text-white font-medium flex items-center">
                  <Calendar className="w-4 h-4 mr-2" />
                  Secrets Enabled
                </h4>
                <p className="text-gray-300 bg-gray-900 p-3 rounded">
                  {app.enable_secrets ? "Yes" : "No"}
                </p>
              </div>
            </div>
          </div>

          {/* Metadata */}
          {app.metadata && Object.keys(app.metadata).length > 0 && (
            <div className="space-y-2">
              <h4 className="text-white font-medium">Metadata</h4>
              <div className="bg-gray-900 p-3 rounded-lg">
                <pre className="text-sm text-gray-300 overflow-x-auto">
                  {JSON.stringify(app.metadata, null, 2)}
                </pre>
              </div>
            </div>
          )}

          {/* Public Key */}
          {app.public_key && (
            <div className="space-y-2">
              <h4 className="text-white font-medium">Public Key</h4>
              <div className="bg-gray-900 p-3 rounded-lg">
                <pre className="text-sm text-gray-300 overflow-x-auto">
                  {app.public_key ? app.public_key : "No public key available"}
                </pre>
              </div>
            </div>
          )}

          {/* Quick Actions */}
          <div className="flex items-center justify-between gap-4 pt-4 border-t border-gray-800">
            <div className="text-xs text-gray-400">
              <Info className="inline-block mr-1" size={16} />
              Manage variables and configurations for this project
            </div>
            <Button
              variant="outline"
              className="text-white border-gray-700 hover:bg-gray-800"
              onClick={() => {
                // Navigate to project environments
                navigate(`/applications/${app.id}`);
              }}
            >
              <ExternalLink className="w-4 h-4 mr-2" />
              View Variables
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
