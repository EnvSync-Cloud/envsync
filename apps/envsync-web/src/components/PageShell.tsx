import type { ReactNode, FC } from "react";
import { Skeleton } from "@/components/ui/skeleton";

interface PageShellProps {
  title: string;
  description?: string;
  icon?: FC<{ className?: string }>;
  actions?: ReactNode;
  children: ReactNode;
  isLoading?: boolean;
}

export function PageShell({
  title,
  description,
  icon: Icon,
  actions,
  children,
  isLoading,
}: PageShellProps) {
  if (isLoading) {
    return (
      <div className="animate-page-enter space-y-6">
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <Skeleton className="h-8 w-48 bg-gray-800" />
            <Skeleton className="h-4 w-72 bg-gray-800" />
          </div>
          <Skeleton className="h-9 w-32 bg-gray-800" />
        </div>
        <div className="space-y-4">
          <Skeleton className="h-64 w-full bg-gray-800 rounded-lg" />
        </div>
      </div>
    );
  }

  return (
    <div className="animate-page-enter space-y-6">
      <div className="flex items-start justify-between">
        <div className="flex items-center space-x-3">
          {Icon && (
            <div className="p-2 bg-violet-500/10 rounded-lg">
              <Icon className="size-5 text-violet-400" />
            </div>
          )}
          <div>
            <h1 className="text-xl font-semibold text-gray-100">{title}</h1>
            {description && (
              <p className="text-sm text-gray-400 mt-0.5">{description}</p>
            )}
          </div>
        </div>
        {actions && <div className="flex items-center space-x-2">{actions}</div>}
      </div>
      {children}
    </div>
  );
}
