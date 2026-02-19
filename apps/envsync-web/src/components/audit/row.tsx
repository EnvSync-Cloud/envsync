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
      className="border-b border-gray-800 hover:bg-gray-800/30 transition-colors"
    >
      <td className="py-3 px-4">
        <div className="flex items-center space-x-2">
          <div className="size-8 bg-gray-800 rounded-full flex items-center justify-center overflow-hidden flex-shrink-0">
            <Avatar className="w-full h-full rounded-none overflow-hidden">
              <AvatarImage
                src={log.profile_picture}
                alt={`${log.user_name} profile`}
                className="w-full h-full object-cover"
              />
              <AvatarFallback className="bg-inherit text-gray-300 text-xs">
                {log.user_name
                  .split(" ")
                  .map((n) => n[0])
                  .join("")
                  .toUpperCase()}
              </AvatarFallback>
            </Avatar>
          </div>
          <div>
            <div className="text-sm font-medium text-gray-200">
              {log.user_name}
            </div>
          </div>
        </div>
      </td>
      <td className="py-3 px-4">
        <Badge
          className={cn(
            "border flex items-center gap-1.5 uppercase text-[10px]",
            log.actionBadgeColor
          )}
        >
          {log.actionIcon}
          <span className="font-medium">{log.actionCategory}</span>
        </Badge>
      </td>
      <td className="py-3 px-4">
        <div className="flex items-center space-x-2">
          <span className="text-gray-500">{log.resourceIcon}</span>
          <div>
            <div className="text-sm text-gray-200">
              {log.project || log.environment || log.action}
            </div>
            {!!log.resource_type && (
              <div className="text-[11px] text-gray-500">{log.resource_type}</div>
            )}
          </div>
        </div>
      </td>
      <td className="py-3 px-4">
        <div>
          <div className="text-sm text-gray-300">
            {formatLastUsed(log.created_at)}
          </div>
          <div className="text-[11px] text-gray-500">
            <Calendar className="inline size-3 mr-1" />
            {formatDate(log.created_at)}
          </div>
        </div>
      </td>
      <td className="py-3 px-4">
        <div>
          <div className="text-sm text-gray-200">
            {log.actionDescription}
          </div>
          {log.details && (
            <div className="text-[11px] text-gray-500 mt-0.5 max-w-xs truncate">
              {log.details}
            </div>
          )}
        </div>
      </td>
    </tr>
  );
};
