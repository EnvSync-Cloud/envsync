"use client";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

interface Item {
  name: string;
  avatar: string;
}

interface AvatarGroupProps {
  items: Item[];
  show?: number;
  size?: "sm" | "md" | "lg";
  className?: string;
}

const sizeClasses = {
  sm: "size-8 text-xs",
  md: "size-10 text-sm",
  lg: "size-12 text-base",
};

const overlapClasses = {
  sm: "-ml-2",
  md: "-ml-3",
  lg: "-ml-4",
};

export function AvatarGroup({
  items: items,
  show = 3,
  size = "md",
  className,
}: AvatarGroupProps) {
  const visibleUsers = items.slice(0, show);
  const remainingCount = items.length - show;

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <div className={cn("flex items-center", className)}>
      {visibleUsers.map((user, index) => (
        <div
          key={`${user.name}-${index}`}
          className={cn(
            "relative transition-transform hover:scale-110 hover:z-10",
            index > 0 && overlapClasses[size]
          )}
        >
          <Avatar className={cn(sizeClasses[size], "border border-background")}>
            <AvatarImage
              src={user.avatar || "/placeholder.svg"}
              alt={user.name}
            />
            <AvatarFallback className="bg-gradient-to-br from-violet-500 to-purple-600 text-white">
              {getInitials(user.name)}
            </AvatarFallback>
          </Avatar>
          {/* Tooltip on hover */}
          <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 bg-black text-white text-xs rounded opacity-0 hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-20">
            {user.name}
          </div>
        </div>
      ))}

      {remainingCount > 0 && (
        <div
          className={cn(
            "relative transition-transform hover:scale-110",
            overlapClasses[size]
          )}
        >
          <Avatar className={cn(sizeClasses[size], "border border-background")}>
            <AvatarFallback className="bg-muted text-muted-foreground font-medium">
              +{remainingCount}
            </AvatarFallback>
          </Avatar>
          {/* Tooltip showing remaining users */}
          <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 bg-black text-white text-xs rounded opacity-0 hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-20 max-w-48">
            {items
              .slice(show)
              .map((user) => user.name)
              .join(", ")}
          </div>
        </div>
      )}
    </div>
  );
}
