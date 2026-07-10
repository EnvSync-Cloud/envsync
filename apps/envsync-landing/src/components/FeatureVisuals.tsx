import { motion } from "framer-motion";
import { Check, LockKeyhole, RefreshCw, ShieldCheck, TriangleAlert } from "lucide-react";
import { cn } from "@/lib/utils";

const frameClassName =
  "relative flex h-full min-h-[8.5rem] w-full overflow-hidden border border-border bg-[linear-gradient(180deg,hsl(var(--surface-2)),hsl(var(--surface-1)))] p-4";

const FeatureFrame = ({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) => (
  <div className={cn(frameClassName, className)}>
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 opacity-40"
      style={{
        backgroundImage:
          "linear-gradient(hsl(var(--border) / 0.45) 1px, transparent 1px), linear-gradient(90deg, hsl(var(--border) / 0.45) 1px, transparent 1px)",
        backgroundSize: "24px 24px",
      }}
    />
    <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/50 to-transparent" />
    <div className="relative z-10 flex h-full w-full">{children}</div>
  </div>
);

const StatusChip = ({
  label,
  tone = "default",
}: {
  label: string;
  tone?: "default" | "primary" | "warning";
}) => {
  const toneClassName =
    tone === "primary"
      ? "border-primary/35 bg-primary/12 text-primary"
      : tone === "warning"
        ? "border-amber-400/30 bg-amber-400/10 text-amber-200"
        : "border-border bg-background/35 text-muted-foreground";

  return (
    <span className={`rounded-full border px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] ${toneClassName}`}>
      {label}
    </span>
  );
};

export const EncryptionVisual = () => (
  <FeatureFrame>
    <div className="grid w-full grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-3">
      <div className="rounded-2xl border border-border bg-background/55 p-3">
        <div className="mb-3 flex items-center justify-between">
          <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Source</span>
          <StatusChip label="App" />
        </div>
        <div className="space-y-2">
          <div className="h-2 rounded-full bg-foreground/12" />
          <div className="h-2 w-3/4 rounded-full bg-foreground/10" />
          <div className="h-2 w-1/2 rounded-full bg-primary/20" />
        </div>
      </div>

      <div className="relative h-px w-10 bg-primary/25">
        <motion.div
          className="absolute -top-1.5 h-3 w-3 rounded-full bg-primary shadow-[0_0_18px_rgba(41,203,136,0.55)]"
          animate={{ x: [0, 28, 0] }}
          transition={{ duration: 3.2, repeat: Infinity, ease: "easeInOut" }}
        />
      </div>

      <div className="rounded-2xl border border-primary/30 bg-primary/8 p-3">
        <div className="mb-3 flex items-center justify-between">
          <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-primary/90">Transit</span>
          <LockKeyhole className="h-4 w-4 text-primary" />
        </div>
        <div className="space-y-2">
          <div className="flex gap-1">
            <div className="h-2 w-4 rounded-full bg-primary/45" />
            <div className="h-2 w-4 rounded-full bg-primary/30" />
            <div className="h-2 w-4 rounded-full bg-primary/45" />
            <div className="h-2 w-4 rounded-full bg-primary/30" />
          </div>
          <div className="h-2 w-5/6 rounded-full bg-primary/20" />
          <div className="h-2 w-2/3 rounded-full bg-primary/12" />
        </div>
      </div>

      <div className="relative h-px w-10 bg-sky-400/25">
        <motion.div
          className="absolute -top-1.5 h-3 w-3 rounded-full bg-sky-300 shadow-[0_0_18px_rgba(56,189,248,0.45)]"
          animate={{ x: [0, 28, 0] }}
          transition={{ duration: 3.2, repeat: Infinity, ease: "easeInOut", delay: 0.35 }}
        />
      </div>

      <div className="rounded-2xl border border-sky-400/25 bg-sky-400/8 p-3">
        <div className="mb-3 flex items-center justify-between">
          <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-sky-100">Protected</span>
          <ShieldCheck className="h-4 w-4 text-sky-300" />
        </div>
        <div className="space-y-2">
          <div className="h-2 w-4/5 rounded-full bg-foreground/12" />
          <div className="h-2 w-2/3 rounded-full bg-foreground/10" />
          <div className="inline-flex items-center gap-1 rounded-full border border-sky-400/25 bg-sky-400/10 px-2 py-1 text-[10px] font-medium text-sky-100">
            <Check className="h-3 w-3" />
            plaintext blocked
          </div>
        </div>
      </div>
    </div>
  </FeatureFrame>
);

export const SyncVisual = () => (
  <FeatureFrame className="min-h-[6.75rem] p-3">
    <div className="flex w-full flex-col gap-2">
      {[
        { env: "DEV", time: "04s", tone: "default" as const },
        { env: "STAGING", time: "now", tone: "primary" as const },
        { env: "PROD", time: "hold", tone: "warning" as const },
      ].map((row, index) => (
        <div key={row.env} className="relative rounded-2xl border border-border bg-background/50 px-3 py-2.5">
          {row.tone === "primary" ? (
            <motion.div
              className="absolute inset-y-0 left-0 w-1/3 rounded-r-full bg-gradient-to-r from-primary/0 via-primary/22 to-primary/0"
              animate={{ x: ["-100%", "200%"] }}
              transition={{ duration: 3.4, repeat: Infinity, ease: "linear", delay: index * 0.2 }}
            />
          ) : null}
          <div className="relative z-10 grid grid-cols-[auto_1fr_auto] items-center gap-2.5">
            <div
              className={`h-2 w-2 rounded-full ${
                row.tone === "primary"
                  ? "bg-primary shadow-[0_0_14px_rgba(41,203,136,0.45)]"
                  : row.tone === "warning"
                    ? "bg-amber-300 shadow-[0_0_14px_rgba(252,211,77,0.35)]"
                    : "bg-sky-300/80"
              }`}
            />
            <div className="text-[11px] font-semibold tracking-[0.16em] text-foreground">{row.env}</div>
            <div className="justify-self-end text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground">{row.time}</div>
          </div>
        </div>
      ))}
    </div>
  </FeatureFrame>
);

export const EnvironmentControlVisual = () => (
  <FeatureFrame>
    <div className="flex w-full flex-col gap-3">
      <div className="grid grid-cols-[1.1fr_repeat(3,minmax(0,1fr))] gap-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
        <span>Policy</span>
        <span className="text-center">dev</span>
        <span className="text-center">staging</span>
        <span className="text-center">prod</span>
      </div>

      {[
        { label: "deploy", values: ["ok", "review", "gate"] },
        { label: "secrets", values: ["ok", "ok", "locked"] },
        { label: "approvals", values: ["0", "1", "2"] },
      ].map((row) => (
        <div key={row.label} className="grid grid-cols-[1.1fr_repeat(3,minmax(0,1fr))] gap-2">
          <div className="flex items-center rounded-xl border border-border bg-background/45 px-3 py-2 text-xs font-medium text-foreground">
            {row.label}
          </div>
          {row.values.map((value, index) => (
            <div
              key={`${row.label}-${value}-${index}`}
              className={`flex items-center justify-center rounded-xl border px-2 py-2 text-xs font-semibold ${
                value === "ok"
                  ? "border-primary/25 bg-primary/10 text-primary"
                  : value === "locked"
                    ? "border-amber-400/30 bg-amber-400/10 text-amber-200"
                    : value === "gate"
                      ? "border-sky-400/25 bg-sky-400/10 text-sky-100"
                      : "border-border bg-background/45 text-muted-foreground"
              }`}
            >
              {value}
            </div>
          ))}
        </div>
      ))}
    </div>
  </FeatureFrame>
);

export const WorkflowVisual = () => (
  <FeatureFrame>
    <div className="grid w-full grid-cols-[140px_minmax(0,1fr)] gap-4">
      <div className="rounded-2xl border border-border bg-background/50 p-3">
        <div className="mb-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">History</div>
        <div className="space-y-2">
          {["build #218", "review approved", "rollback point"].map((item, index) => (
            <div key={item} className="flex items-center gap-2">
              <div className={`h-2.5 w-2.5 rounded-full ${index === 1 ? "bg-primary" : "bg-foreground/20"}`} />
              <div className="h-2 flex-1 rounded-full bg-foreground/10" />
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-background/55 p-3">
        <div className="mb-3 flex items-center justify-between">
          <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Diff preview</span>
          <StatusChip label="rollback ready" tone="primary" />
        </div>
        <div className="space-y-2 rounded-xl border border-border bg-background/60 p-3 font-mono text-[11px]">
          <div className="flex items-center gap-2 text-red-200/85">
            <span className="text-red-300">-</span>
            <span>API_HOST=old.internal</span>
          </div>
          <div className="flex items-center gap-2 text-primary/95">
            <span className="text-primary">+</span>
            <span>API_HOST=api.envsync.cloud</span>
          </div>
          <div className="flex items-center gap-2 text-sky-100/90">
            <span>~</span>
            <span>SYNC_WINDOW=15s</span>
          </div>
        </div>
      </div>
    </div>
  </FeatureFrame>
);

export const AccessVisual = () => (
  <FeatureFrame>
    <div className="flex w-full flex-col gap-3">
      <div className="grid grid-cols-[1.2fr_repeat(3,minmax(0,1fr))] gap-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
        <span>Role</span>
        <span className="text-center">read</span>
        <span className="text-center">edit</span>
        <span className="text-center">approve</span>
      </div>

      {[
        { role: "platform", values: ["full", "full", "yes"] },
        { role: "release", values: ["full", "limited", "yes"] },
        { role: "contractor", values: ["read", "none", "none"] },
      ].map((row) => (
        <div key={row.role} className="grid grid-cols-[1.2fr_repeat(3,minmax(0,1fr))] gap-2">
          <div className="rounded-xl border border-border bg-background/45 px-3 py-2 text-xs font-medium text-foreground">
            {row.role}
          </div>
          {row.values.map((value, index) => (
            <div
              key={`${row.role}-${value}-${index}`}
              className={`flex items-center justify-center rounded-xl border px-2 py-2 text-xs font-semibold ${
                value === "none"
                  ? "border-red-400/20 bg-red-400/10 text-red-200/90"
                  : value === "yes" || value === "full"
                    ? "border-primary/25 bg-primary/10 text-primary"
                    : "border-sky-400/25 bg-sky-400/10 text-sky-100"
              }`}
            >
              {value}
            </div>
          ))}
        </div>
      ))}
    </div>
  </FeatureFrame>
);

export const LifecycleVisual = () => (
  <FeatureFrame>
    <div className="flex w-full flex-col justify-between">
      <div className="grid grid-cols-4 items-stretch gap-3">
        {[
          { label: "issue", icon: Check, tone: "primary" as const },
          { label: "rotate", icon: RefreshCw, tone: "default" as const },
          { label: "expire", icon: TriangleAlert, tone: "warning" as const },
          { label: "renew", icon: ShieldCheck, tone: "primary" as const },
        ].map(({ label, icon: Icon, tone }) => (
          <div
            key={label}
            className="flex min-h-[88px] flex-col items-center justify-center rounded-2xl border border-border bg-background/45 px-2 py-3 text-center"
          >
            <div
              className={`flex h-9 w-9 items-center justify-center rounded-full border ${
                tone === "warning"
                  ? "border-amber-400/35 bg-amber-400/10 text-amber-200"
                  : tone === "primary"
                    ? "border-primary/35 bg-primary/12 text-primary"
                    : "border-sky-400/25 bg-sky-400/10 text-sky-100"
              }`}
            >
              <Icon className={`h-4 w-4 ${label === "rotate" ? "animate-[spin_6s_linear_infinite]" : ""}`} />
            </div>
            <div className="mt-3 text-center text-[11px] font-semibold uppercase tracking-[0.16em] text-foreground">
              {label}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-4 h-2 overflow-hidden rounded-full bg-foreground/10">
        <motion.div
          className="h-full rounded-full bg-gradient-to-r from-primary via-sky-300 to-amber-300"
          animate={{ x: ["-30%", "20%", "55%"] }}
          transition={{ duration: 4.2, repeat: Infinity, ease: "easeInOut" }}
          style={{ width: "55%" }}
        />
      </div>
    </div>
  </FeatureFrame>
);
