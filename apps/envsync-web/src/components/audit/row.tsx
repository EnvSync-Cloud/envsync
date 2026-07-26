import { ReactNode } from "react";
import { Avatar, AvatarImage, AvatarFallback } from "../ui/avatar";
import { AuditActions } from "@/lib/audit.type";
import { cn, formatDate, formatLastUsed, truncateUUIDs } from "@/lib/utils";
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
      className="border-b border-border hover:bg-muted/30 transition-colors"
    >
      <td className="py-3 px-4">
        <div className="flex items-center space-x-2">
          <div className="size-8 bg-muted rounded-full flex items-center justify-center overflow-hidden flex-shrink-0">
            <Avatar className="w-full h-full rounded-none overflow-hidden">
              <AvatarImage
                src={log.profile_picture}
                alt={`${log.user_name} profile`}
                className="w-full h-full object-cover"
              />
              <AvatarFallback className="bg-inherit text-muted-foreground text-xs">
                {log.user_name
                  .split(" ")
                  .map((n) => n[0])
                  .join("")
                  .toUpperCase()}
              </AvatarFallback>
            </Avatar>
          </div>
          <div>
            <div className="text-sm font-medium text-foreground">
              {log.user_name}
            </div>
          </div>
        </div>
      </td>
      <td className="py-3 px-4">
        <div className="flex items-center space-x-2">
          <span className="text-tertiary">{log.resourceIcon}</span>
          <div>
            <div className="text-sm text-foreground">
              {log.project || log.environment || log.action}
            </div>
            {!!log.resource_type && (
              <div className="text-[11px] text-tertiary">{log.resource_type}</div>
            )}
          </div>
        </div>
      </td>
      <td className="py-3 px-4">
        <div>
          <div className="text-sm text-muted-foreground">
            {formatLastUsed(log.created_at)}
          </div>
          <div className="text-[11px] text-tertiary">
            <Calendar className="inline size-3 mr-1" />
            {formatDate(log.created_at)}
          </div>
        </div>
      </td>
      <td className="py-3 px-4">
        <div>
          <div className="text-sm text-foreground">
            {log.actionDescription}
          </div>
          {log.details && (
            <div className="text-[11px] text-tertiary mt-0.5 max-w-xs truncate">
              {truncateUUIDs(log.details)}
            </div>
          )}
        </div>
      </td>
    </tr>
  );
};
