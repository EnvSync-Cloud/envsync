import { Shield, GitBranch, Zap, Lock, History, GitPullRequest, Eye, RotateCcw } from "lucide-react";

const features = [
  {
    icon: GitBranch,
    title: "Environment promotion",
    description: "Move config through dev → staging → production with approval gates. No more copy-pasting .env files.",
  },
  {
    icon: Shield,
    title: "Approval gates",
    description: "Require review before production changes. Track who approved what and when.",
  },
  {
    icon: Zap,
    title: "Instant sync",
    description: "Propagate changes across environments in seconds. CLI-first workflow that fits your existing tools.",
  },
  {
    icon: Lock,
    title: "End-to-end encryption",
    description: "AES-256 encryption at rest and in transit. Zero-knowledge architecture keeps secrets safe.",
  },
];

const uniqueFeatures = [
  {
    icon: RotateCcw,
    title: "Point-in-time rollback",
    description: "Undo any secret change to any previous state. Full history with diff visibility.",
    badge: "Unique",
  },
  {
    icon: GitPullRequest,
    title: "Change request workflows",
    description: "Protected environments require approval before changes go live. Self-approval blocked.",
    badge: "Unique",
  },
  {
    icon: Eye,
    title: "Audit trail",
    description: "Track every change with who, what, when. Export to Datadog, Splunk, or Sumo Logic.",
    badge: "Enterprise",
  },
  {
    icon: History,
    title: "Secret rotation",
    description: "Auto-rotate database credentials, AWS IAM keys, and Azure service principals.",
    badge: "Enterprise",
  },
];

const NewFeatures = () => {
  return (
    <section className="border-b border-border bg-[#0a0f15]">
      <div className="container mx-auto px-4 py-24 md:px-8 md:py-32">
        {/* Core features */}
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-bold tracking-tight text-foreground md:text-4xl">
            Why teams switch to EnvSync
          </h2>
          <p className="mt-4 text-lg text-muted-foreground">
            Stop emailing .env files. Start shipping config with confidence.
          </p>
        </div>

        <div className="mx-auto mt-16 grid max-w-5xl gap-8 md:grid-cols-2 lg:grid-cols-4">
          {features.map((feature) => (
            <div
              key={feature.title}
              className="rounded-xl border border-border bg-card p-6 transition-colors hover:bg-accent/50"
            >
              <feature.icon className="h-10 w-10 text-primary" />
              <h3 className="mt-4 text-lg font-semibold text-foreground">
                {feature.title}
              </h3>
              <p className="mt-2 text-sm text-muted-foreground">
                {feature.description}
              </p>
            </div>
          ))}
        </div>

        {/* Unique features */}
        <div className="mx-auto mt-24 max-w-5xl">
          <div className="mx-auto max-w-2xl text-center mb-12">
            <h3 className="text-2xl font-bold tracking-tight text-foreground md:text-3xl">
              What makes EnvSync different
            </h3>
            <p className="mt-4 text-base text-muted-foreground">
              Features no other secrets manager has.
            </p>
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            {uniqueFeatures.map((feature) => (
              <div
                key={feature.title}
                className="rounded-xl border border-border bg-card p-6 transition-colors hover:bg-accent/50"
              >
                <div className="flex items-start justify-between">
                  <feature.icon className="h-8 w-8 text-primary" />
                  {feature.badge && (
                    <span className="inline-flex items-center rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-0.5 text-xs font-medium text-emerald-400">
                      {feature.badge}
                    </span>
                  )}
                </div>
                <h4 className="mt-4 text-lg font-semibold text-foreground">
                  {feature.title}
                </h4>
                <p className="mt-2 text-sm text-muted-foreground">
                  {feature.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};

export default NewFeatures;
