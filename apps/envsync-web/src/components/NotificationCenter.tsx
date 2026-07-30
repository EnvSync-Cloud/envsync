import { useEffect, useState } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { CheckCheck, Trash2, Bell } from "lucide-react";
import { useNotifications, type Notification } from "@/hooks/useNotifications";
import { formatLastUsed } from "@/lib/utils";

function getTypeColor(type: Notification["type"]) {
  switch (type) {
    case "success":
      return "bg-green-500";
    case "error":
      return "bg-red-500";
    case "warning":
      return "bg-amber-500";
    case "info":
      return "bg-blue-500";
  }
}

export function NotificationCenter() {
  const [open, setOpen] = useState(false);
  const { notifications, unreadCount, markAllRead, clearAll } =
    useNotifications();

  useEffect(() => {
    const handleToggle = () => setOpen((prev) => !prev);
    window.addEventListener("toggle-notification-center", handleToggle);
    return () =>
      window.removeEventListener("toggle-notification-center", handleToggle);
  }, []);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetContent className="bg-popover/95 backdrop-blur-md border-border/50 w-[360px] sm:w-[400px]">
        <SheetHeader>
          <div className="flex items-center justify-between">
            <SheetTitle className="text-foreground">Notifications</SheetTitle>
            <div className="flex items-center space-x-1">
              {unreadCount > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={markAllRead}
                  className="text-muted-foreground hover:text-foreground h-8 px-2"
                >
                  <CheckCheck className="size-3.5 mr-1" />
                  <span className="text-xs">Mark all read</span>
                </Button>
              )}
              {notifications.length > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={clearAll}
                  className="text-muted-foreground hover:text-foreground h-8 px-2"
                  aria-label="Clear all notifications"
                >
                  <Trash2 className="size-3.5" />
                </Button>
              )}
            </div>
          </div>
          <SheetDescription className="text-tertiary text-xs">
            {unreadCount > 0
              ? `${unreadCount} unread notification${unreadCount > 1 ? "s" : ""}`
              : "All caught up"}
          </SheetDescription>
        </SheetHeader>

        <div className="mt-4 space-y-1">
          {notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Bell className="size-8 text-muted-foreground/50 mb-3" />
              <p className="text-sm text-tertiary">No notifications yet</p>
              <p className="text-xs text-muted-foreground/60 mt-1">
                Actions and events will appear here
              </p>
            </div>
          ) : (
            notifications.map((notification) => (
              <div
                key={notification.id}
                className={`flex items-start space-x-3 p-3 rounded-lg transition-colors ${
                  notification.read
                    ? "opacity-60"
                    : "bg-muted/30"
                }`}
              >
                <div
                  className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${getTypeColor(
                    notification.type
                  )}`}
                />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-foreground/80">{notification.message}</p>
                  <p className="text-[11px] text-tertiary mt-0.5">
                    {formatLastUsed(notification.timestamp.toISOString())}
                  </p>
                </div>
              </div>
            ))
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
