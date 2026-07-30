import { useState } from "react"
import {
  GitBranch,
  Shield,
  Zap,
  Lock,
  RotateCcw,
  GitPullRequest,
  Eye,
  History,
} from "lucide-react"
import { SectionHeading } from "@/components/primitives/SectionHeading"
import { TabPills, type Tab } from "@/components/primitives/TabPills"
import { CropMarkFrame } from "@/components/primitives/CropMarkFrame"
import { Button } from "@/components/primitives/Button"
import { cn } from "@/lib/utils"

/* -------------------------------------------------------------------------- */
/*  Block 1 — Why teams switch                                                */
/* -------------------------------------------------------------------------- */

const switchFeatures = [
  {
    icon: GitBranch,
    title: "Environment promotion",
    description:
      "Move config through dev \u2192 staging \u2192 production with approval gates. No more copy-pasting .env files.",
  },
  {
    icon: Shield,
    title: "Approval gates",
    description:
      "Require review before production changes. Track who approved what and when.",
  },
  {
    icon: Zap,
    title: "Instant sync",
    description:
      "Propagate changes across environments in seconds. CLI-first workflow that fits your existing tools.",
  },
  {
    icon: Lock,
    title: "End-to-end encryption",
    description:
      "AES-256 encryption at rest and in transit. Zero-knowledge architecture keeps secrets safe.",
  },
]

/* -------------------------------------------------------------------------- */
/*  Block 2 — Tab definitions                                                  */
/* -------------------------------------------------------------------------- */

const differentiatorTabs: Tab[] = [
  { id: "rollback", label: "Rollback", icon: RotateCcw },
  { id: "approvals", label: "Approvals", icon: GitPullRequest },
  { id: "audit", label: "Audit", icon: Eye },
  { id: "rotation", label: "Rotation", icon: History },
]

const tabMeta: Record<
  string,
  { title: string; description: string; badge: string }
> = {
  rollback: {
    title: "Full history, any point restore",
    description:
      "Every secret change is versioned. Roll back any variable to any previous state with a single command. Full diff visibility between versions.",
    badge: "UNIQUE",
  },
  approvals: {
    title: "Protected environments, enforced review",
    description:
      "Production changes require approval from a designated reviewer. Self-approval is blocked. Change requests carry full diffs and context.",
    badge: "UNIQUE",
  },
  audit: {
    title: "Every action, attributable and exportable",
    description:
      "Full audit trail of who changed what, when, and from where. Stream events to Datadog, Splunk, or Sumo Logic for compliance and alerting.",
    badge: "ENTERPRISE",
  },
  rotation: {
    title: "Credentials that expire on schedule",
    description:
      "Auto-rotate database credentials, AWS IAM keys, and Azure service principals on configurable schedules. Zero-downtime rotation with atomic swaps.",
    badge: "ENTERPRISE",
  },
}

/* -------------------------------------------------------------------------- */
/*  Block 2 — Faux-UI panels                                                   */
/* -------------------------------------------------------------------------- */

function RollbackPanel() {
  const rows = [
    { version: "v30492", time: "2 min ago", actor: "jw", status: "current" as const },
    { version: "v30491", time: "18 min ago", actor: "jw", status: "rolled back" as const },
    { version: "v30490", time: "1 hr ago", actor: "sk", status: "applied" as const },
    { version: "v30489", time: "3 hr ago", actor: "jw", status: "applied" as const },
    { version: "v30488", time: "1d ago", actor: "sk", status: "applied" as const },
  ]

  return (
    <CropMarkFrame>
      <div className="overflow-hidden rounded-lg border border-border bg-card">
        <div className="flex items-center gap-3 border-b border-border bg-card px-4 py-2.5">
          <span className="font-mono text-mono-label text-foreground">version history</span>
          <span className="ml-auto font-mono text-mono-label text-muted-foreground">
            5 versions
          </span>
        </div>
        {rows.map((row) => (
          <div
            key={row.version}
            className={cn(
              "flex items-center gap-4 border-b border-border px-4 py-3 last:border-b-0",
              row.status === "current" &&
                "border-l-2 border-l-primary bg-accent-surface",
            )}
          >
            <span className="font-mono text-mono-label text-foreground">
              {row.version}
            </span>
            <span className="font-mono text-mono-label text-muted-foreground">
              {row.time}
            </span>
            <span className="font-mono text-mono-label text-muted-foreground">
              {row.actor}
            </span>
            <span
              className={cn(
                "ml-auto rounded-full border px-2 py-0.5 font-mono text-mono-label",
                row.status === "current" &&
                  "border-primary/30 text-accent-ink",
                row.status === "rolled back" &&
                  "border-status-warning/30 text-status-warning",
                row.status === "applied" &&
                  "border-border text-muted-foreground",
              )}
            >
              {row.status}
            </span>
          </div>
        ))}
      </div>
    </CropMarkFrame>
  )
}

function ApprovalsPanel() {
  return (
    <CropMarkFrame>
      <div className="overflow-hidden rounded-lg border border-border bg-card">
        <div className="flex items-center gap-3 border-b border-border bg-card px-4 py-2.5">
          <span className="font-mono text-mono-label text-foreground">
            cr_abc123
          </span>
          <span className="ml-auto rounded-full border border-status-warning/30 px-2 py-0.5 font-mono text-mono-label text-status-warning">
            pending review
          </span>
        </div>
        <div className="space-y-0 border-b border-border px-4 py-3">
          <div className="flex items-center gap-3 font-mono text-sm">
            <span className="text-status-error">-</span>
            <span className="text-muted-foreground line-through">
              DATABASE_URL=postgres://staging-db.internal:5432/app
            </span>
          </div>
          <div className="flex items-center gap-3 font-mono text-sm">
            <span className="text-accent-ink">+</span>
            <span className="text-foreground">
              DATABASE_URL=postgres://prod-db.internal:5432/app
            </span>
          </div>
          <div className="flex items-center gap-3 font-mono text-sm">
            <span className="text-accent-ink">+</span>
            <span className="text-foreground">
              CACHE_TTL=300
            </span>
          </div>
        </div>
        <div className="flex items-center gap-3 px-4 py-3">
          <Button variant="primary" size="sm">
            Approve
          </Button>
          <Button variant="outline" size="sm">
            Request changes
          </Button>
          <span className="ml-auto text-xs text-muted-foreground">
            Self-approval blocked
          </span>
        </div>
      </div>
    </CropMarkFrame>
  )
}

function AuditPanel() {
  const logLines = [
    { time: "2026-07-23T14:02Z", actor: "jw@acme.co", action: "UPDATE", target: "DATABASE_URL" },
    { time: "2026-07-23T13:58Z", actor: "sk@acme.co", action: "CREATE", target: "REDIS_URL" },
    { time: "2026-07-23T13:45Z", actor: "ci-bot", action: "ROTATE", target: "AWS_SECRET_KEY" },
    { time: "2026-07-23T12:30Z", actor: "jw@acme.co", action: "APPROVE", target: "cr_xyz789" },
    { time: "2026-07-23T11:12Z", actor: "sk@acme.co", action: "ROLLBACK", target: "STRIPE_KEY" },
  ]

  return (
    <CropMarkFrame>
      <div className="overflow-hidden rounded-lg border border-border bg-card">
        <div className="flex items-center gap-3 border-b border-border bg-card px-4 py-2.5">
          <span className="font-mono text-mono-label text-foreground">
            audit trail
          </span>
          <span className="ml-auto font-mono text-mono-label text-muted-foreground">
            prod / last 24h
          </span>
        </div>
        <div className="divide-y divide-border">
          {logLines.map((line) => (
            <div
              key={`${line.time}-${line.target}`}
              className="flex items-center gap-3 px-4 py-2.5 font-mono text-sm"
            >
              <span className="shrink-0 text-muted-foreground">
                {line.time}
              </span>
              <span className="shrink-0 text-foreground">{line.actor}</span>
              <span className="shrink-0 text-accent-ink">{line.action}</span>
              <span className="ml-auto truncate text-muted-foreground">
                {line.target}
              </span>
            </div>
          ))}
        </div>
        <div className="flex items-center gap-4 border-t border-border px-4 py-2.5">
          <span className="font-mono text-mono-label text-muted-foreground">
            export to
          </span>
          {["Datadog", "Splunk", "Sumo Logic"].map((name) => (
            <span
              key={name}
              className="font-mono text-mono-label text-tertiary"
            >
              {name}
            </span>
          ))}
        </div>
      </div>
    </CropMarkFrame>
  )
}

function RotationPanel() {
  const schedules = [
    {
      service: "postgres/prod",
      schedule: "every 30d",
      lastRotated: "3d ago",
      auto: true,
    },
    {
      service: "aws/iam-deploy",
      schedule: "every 90d",
      lastRotated: "42d ago",
      auto: true,
    },
    {
      service: "azure/sp-pipeline",
      schedule: "every 60d",
      lastRotated: "58d ago",
      auto: false,
    },
    {
      service: "stripe/api-key",
      schedule: "manual",
      lastRotated: "14d ago",
      auto: false,
    },
  ]

  return (
    <CropMarkFrame>
      <div className="overflow-hidden rounded-lg border border-border bg-card">
        <div className="flex items-center gap-3 border-b border-border bg-card px-4 py-2.5">
          <span className="font-mono text-mono-label text-foreground">
            rotation schedule
          </span>
          <span className="ml-auto font-mono text-mono-label text-muted-foreground">
            4 policies
          </span>
        </div>
        <div className="divide-y divide-border">
          {schedules.map((item) => (
            <div
              key={item.service}
              className="flex items-center gap-4 px-4 py-3"
            >
              <span className="font-mono text-sm text-foreground">
                {item.service}
              </span>
              <span className="ml-auto font-mono text-mono-label text-muted-foreground">
                {item.schedule}
              </span>
              <span className="font-mono text-mono-label text-muted-foreground">
                last {item.lastRotated}
              </span>
              {item.auto && (
                <span className="rounded-full bg-primary px-2 py-0.5 font-mono text-mono-label text-primary-foreground">
                  auto-rotated
                </span>
              )}
            </div>
          ))}
        </div>
        <div className="border-t border-dashed border-border px-4 py-3">
          <div className="flex items-center gap-3">
            <span className="font-mono text-mono-label text-muted-foreground">
              next rotation
            </span>
            <span className="font-mono text-mono-label text-foreground">
              azure/sp-pipeline in 2d
            </span>
            <span className="ml-auto font-mono text-mono-label text-accent-ink">
              scheduled
            </span>
          </div>
        </div>
      </div>
    </CropMarkFrame>
  )
}

const panels: Record<string, () => JSX.Element> = {
  rollback: RollbackPanel,
  approvals: ApprovalsPanel,
  audit: AuditPanel,
  rotation: RotationPanel,
}

/* -------------------------------------------------------------------------- */
/*  Component                                                                  */
/* -------------------------------------------------------------------------- */

const NewFeatures = () => {
  const [activeTab, setActiveTab] = useState<string>("rollback")
  const ActivePanel = panels[activeTab]
  const meta = tabMeta[activeTab]

  return (
    <section className="border-t border-border bg-background bg-grid-box">
      <div className="mx-auto max-w-[1280px] px-4 py-16 sm:px-8 md:py-24">
        {/* ------------------------------------------------------------------ */}
        {/*  Block 1 — Why teams switch                                         */}
        {/* ------------------------------------------------------------------ */}
        <SectionHeading
          align="center"
          eyebrow="PLATFORM"
          title="Why teams switch to EnvSync"
          description="Stop emailing .env files. Start shipping config with confidence."
        />

        <div className="mt-16 grid gap-px overflow-hidden rounded-lg border border-border bg-border sm:grid-cols-2 lg:grid-cols-4">
          {switchFeatures.map((feature) => (
            <div
              key={feature.title}
              className="bg-background p-6 md:p-8"
            >
              <feature.icon
                className="h-6 w-6 text-foreground"
                strokeWidth={1.5}
              />
              <h3 className="mt-4 text-h3 font-medium text-foreground">
                {feature.title}
              </h3>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                {feature.description}
              </p>
            </div>
          ))}
        </div>

        {/* ------------------------------------------------------------------ */}
        {/*  Block 2 — What makes EnvSync different                             */}
        {/* ------------------------------------------------------------------ */}
        <div className="mt-24 md:mt-32">
          <SectionHeading
            align="center"
            eyebrow="DIFFERENTIATORS"
            title="What makes EnvSync different"
            description="Features no other secrets manager has."
          />

          <TabPills
            className="justify-center"
            tabs={differentiatorTabs}
            active={activeTab}
            onChange={setActiveTab}
          />

          <div className="mt-8 grid items-center gap-8 md:grid-cols-2">
            {/* Left — copy */}
            <div>
              <h3 className="text-h2 font-medium text-foreground">
                {meta.title}
              </h3>
              <p className="mt-4 text-muted-foreground">{meta.description}</p>
              <span className="mt-4 inline-block font-mono text-mono-label uppercase text-accent-ink">
                {meta.badge}
              </span>
            </div>

            {/* Right — faux-UI panel */}
            <div>
              <ActivePanel />
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

export default NewFeatures
