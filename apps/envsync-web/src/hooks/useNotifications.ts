import { useState, useCallback } from "react";

export interface Notification {
  id: string;
  type: "success" | "error" | "info" | "warning";
  message: string;
  timestamp: Date;
  read: boolean;
}

let globalId = 0;

export function useNotifications() {
  const [notifications, setNotifications] = useState<Notification[]>([]);

  const push = useCallback(
    (type: Notification["type"], message: string) => {
      const notification: Notification = {
        id: String(++globalId),
        type,
        message,
        timestamp: new Date(),
        read: false,
      };
      setNotifications((prev) => [notification, ...prev].slice(0, 50));
    },
    []
  );

  const markAsRead = useCallback((id: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n))
    );
  }, []);

  const markAllRead = useCallback(() => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  }, []);

  const clearAll = useCallback(() => {
    setNotifications([]);
  }, []);

  const unreadCount = notifications.filter((n) => !n.read).length;

  return {
    notifications,
    unreadCount,
    push,
    markAsRead,
    markAllRead,
    clearAll,
  };
}
