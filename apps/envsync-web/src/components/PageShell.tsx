import type { ReactNode, FC } from "react";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";

type PageShellStatTone = "default" | "success" | "warning" | "danger";

interface PageShellStat {
  label: string;
  value: ReactNode;
  hint?: string;
  tone?: PageShellStatTone;
}

interface PageShellProps {
  title: string;
  description?: string;
  icon?: FC<{ className?: string }>;
  actions?: ReactNode;
  secondaryNav?: ReactNode;
  statusBanner?: ReactNode;
  stats?: PageShellStat[];
  /** Dashboard overview only. List pages should omit stats or use inline. */
  statLayout?: "inline" | "cards";
  stickyActions?: boolean;
  children: ReactNode;
  isLoading?: boolean;
}

const toneClasses: Record<PageShellStatTone, string> = {
  default: "border-border bg-muted/50 text-foreground",
  success: "border-emerald-500/20 bg-emerald-500/[0.08] text-emerald-100",
  warning: "border-amber-500/20 bg-amber-500/[0.08] text-amber-100",
  danger: "border-rose-500/20 bg-rose-500/[0.08] text-rose-100",
};

export function PageShell({
  title,
  description,
  icon: Icon,
  actions,
  secondaryNav,
  statusBanner,
  stats,
  statLayout = "inline",
  stickyActions = false,
  children,
  isLoading,
}: PageShellProps) {
  if (isLoading) {
    return (
      <div className="animate-page-enter space-y-6">
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-40" />
          <Skeleton className="h-9 w-28" />
        </div>
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    );
  }

  const showCards = statLayout === "cards" && stats && stats.length > 0;
  const inlineStats = statLayout === "inline" ? stats?.filter((stat) => {
    const value = stat.value;
    if (typeof value === "number") return value > 0;
    return value != null && value !== "" && value !== 0;
  }) : undefined;

  return (
    <div className="animate-page-enter space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          {Icon && <Icon className="size-5 shrink-0 text-muted-foreground" />}
          <div className="min-w-0">
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <h1 className="text-xl font-semibold tracking-tight text-foreground">{title}</h1>
              {inlineStats && inlineStats.length > 0 && (
                <p className="text-sm text-muted-foreground">
                  {inlineStats.map((stat) => `${stat.value} ${stat.label.toLowerCase()}`).join(" · ")}
                </p>
              )}
            </div>
            {description ? (
              <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>
            ) : null}
          </div>
        </div>
        {actions && (
          <div
            className={cn(
              "flex flex-wrap items-center gap-2",
              stickyActions && "lg:sticky lg:top-0 lg:justify-end",
            )}
          >
            {actions}
          </div>
        )}
      </div>

      {showCards && (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {stats!.map((stat) => (
            <div
              key={stat.label}
              className={cn("rounded-xl border p-4", toneClasses[stat.tone ?? "default"])}
            >
              <p className="text-xs uppercase tracking-wider text-muted-foreground">{stat.label}</p>
              <div className="mt-1 text-2xl font-medium tracking-tight">{stat.value}</div>
            </div>
          ))}
        </div>
      )}

      {statusBanner}

      {secondaryNav && <div className="border-b border-border pb-px">{secondaryNav}</div>}

      {children}
    </div>
  );
}
