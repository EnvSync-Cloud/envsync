import type { ReactNode } from "react";

export function EnterprisePageFrame({
  title,
  description,
  icon,
  enabled,
  isError,
  error,
  actions,
  children,
}: {
  title: string;
  description?: string;
  icon?: ReactNode;
  enabled: boolean;
  isError?: boolean;
  error?: unknown;
  actions?: ReactNode;
  children?: ReactNode;
}) {
  if (!enabled) {
    return (
      <div className="mx-auto max-w-4xl space-y-4 px-6 py-8">
        <h1 className="text-2xl font-semibold">{title}</h1>
        <p className="text-sm text-muted-foreground">
          Enterprise modules are not enabled on this dashboard build.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl space-y-8 px-6 py-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2">
          <p className="text-xs uppercase tracking-[0.24em] text-emerald-600 dark:text-emerald-300/80">
            Enterprise
          </p>
          <h1 className="flex items-center gap-2 text-3xl font-semibold text-foreground">
            {icon}
            {title}
          </h1>
          {description ? (
            <p className="max-w-2xl text-sm text-muted-foreground">{description}</p>
          ) : null}
        </div>
        {actions}
      </div>
      {isError ? (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          {error instanceof Error ? error.message : "Failed to load"}
        </div>
      ) : null}
      {children}
    </div>
  );
}
