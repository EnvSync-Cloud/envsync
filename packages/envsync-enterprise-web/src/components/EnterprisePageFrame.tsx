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
  variant = "column",
}: {
  title: string;
  description?: string;
  icon?: ReactNode;
  enabled: boolean;
  isError?: boolean;
  error?: unknown;
  actions?: ReactNode;
  children?: ReactNode;
  /** `shell` sits in the dashboard content well. `column` is a centered reading width. */
  variant?: "column" | "shell";
}) {
  const frameClass = variant === "shell" ? "space-y-5" : "mx-auto max-w-5xl space-y-8 px-6 py-8";

  if (!enabled) {
    return (
      <div className={frameClass}>
        <h1 className="text-xl font-semibold">{title}</h1>
        <p className="text-sm text-muted-foreground">
          Enterprise modules are not enabled on this dashboard build.
        </p>
      </div>
    );
  }

  return (
    <div className={frameClass}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0 space-y-0.5">
          <h1 className="flex items-center gap-2 text-xl font-semibold tracking-tight text-foreground">
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
