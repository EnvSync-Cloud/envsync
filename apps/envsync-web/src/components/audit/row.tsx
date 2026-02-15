import { ReactNode } from "react";
import { Avatar, AvatarImage, AvatarFallback } from "../ui/avatar";
import { AuditActions } from "@/lib/audit.type";
import { cn, formatDate, formatLastUsed } from "@/lib/utils";
import { Badge } from "../ui/badge";
import { Calendar } from "lucide-react";

export interface AuditLog {
  id: string;
  action: AuditActions;
  details: string;
  user_name: string;
  profile_picture: string;
  user_id: string;
  timestamp: string;
  created_at: string;
  project?: string;
  environment?: string;
  resource_type?: string;
  resource_id?: string;
  ip_address?: string;
  user_agent?: string;
}

interface Log extends AuditLog {
  actionIcon: ReactNode;
  actionBadgeColor: string;
  actionCategory: string;
  actionDescription: string;
  resourceIcon: ReactNode;
}

interface AuditLogRowProps {
  log: Log;
}

export const AuditLogRow = ({ log }: AuditLogRowProps) => {
  return (
    <tr
      key={log.id}
      className="border-b border-gray-700 hover:bg-gray-750 transition-colors"
    >
      <td className="py-4 px-4">
        <div className="flex items-center space-x-2">
          <div className="size-10 bg-gray-700 rounded-full flex items-center justify-center overflow-hidden">
            <Avatar className="w-full h-full rounded-none overflow-hidden">
              <AvatarImage
                src={log.profile_picture}
                alt={`${log.user_name} profile`}
                className="w-full h-full object-cover"
              />
              <AvatarFallback className="bg-inherit text-white">
                {log.user_name
                  .split(" ")
                  .map((n) => n[0])
                  .join("")
                  .toUpperCase()}
              </AvatarFallback>
            </Avatar>
          </div>
          <div>
            <div className="text-sm font-medium text-white">
              {log.user_name}
            </div>
            <div className="text-xs text-gray-400">
              {log.ip_address || "Unknown IP"}
            </div>
          </div>
        </div>
      </td>
      <td className="py-4 px-4">
        <div className="flex items-center space-x-3">
          <Badge
            className={cn(
              "border flex items-center gap-2 uppercase",
              log.actionBadgeColor
            )}
          >
            {log.actionIcon}
            <span className="text-xs font-medium">{log.actionCategory}</span>
          </Badge>
        </div>
      </td>
      <td className="py-4 px-4">
        <div className="flex items-center space-x-2">
          {log.resourceIcon}
          <div>
            <div className="text-sm font-medium text-white">
              {log.project || log.environment || log.action}
            </div>
            {!!log.resource_type && (
              <div className="text-xs text-gray-400">{log.resource_type}</div>
            )}
          </div>
        </div>
      </td>
      <td className="py-4 px-4">
        <div className="flex items-center space-x-1">
          <div>
            <div className="text-sm text-gray-300">
              {formatLastUsed(log.created_at)}
            </div>
            <div className="text-xs text-gray-400">
              <Calendar className="inline size-3 mr-1" />
              {formatDate(log.created_at)}
            </div>
          </div>
        </div>
      </td>
      <td className="py-4 px-4">
        <div>
          <div className="text-sm font-medium text-white">
            {log.actionDescription}
          </div>
          {log.details && (
            <div className="text-xs text-gray-400 mt-1 max-w-xs truncate">
              {log.details}
            </div>
          )}
        </div>
      </td>
    </tr>
  );
};
