import { Shield, Zap, Globe, GitBranch, Users, Lock } from "lucide-react";
import { BentoGrid, BentoGridItem } from "./ui/bento-grid";
import { motion } from "framer-motion";
import {
  AccessVisual,
  EncryptionVisual,
  EnvironmentControlVisual,
  LifecycleVisual,
  SyncVisual,
  WorkflowVisual,
} from "./FeatureVisuals";

const features = [
  {
    title: "End-to-end encryption",
    description: "AES-256 and zero-knowledge handling keep plaintext out of the wrong places.",
    header: <EncryptionVisual />,
    icon: <Shield className="h-4 w-4 text-primary" />,
    className: "md:col-span-2",
  },
  {
    title: "Fast sync",
    description: "Propagate reviewed config across environments in seconds.",
    header: <SyncVisual />,
    icon: <Zap className="h-4 w-4 text-primary" />,
    className: "md:col-span-1",
  },
  {
    title: "Multi-environment control",
    description: "Operate dev, staging, and prod from one promotion surface.",
    header: <EnvironmentControlVisual />,
    icon: <Globe className="h-4 w-4 text-primary" />,
    className: "md:col-span-1",
  },
  {
    title: "Versioned workflows",
    description: "Track every change with diff visibility and rollback context.",
    header: <WorkflowVisual />,
    icon: <GitBranch className="h-4 w-4 text-primary" />,
    className: "md:col-span-2",
  },
  {
    title: "Team-level access",
    description: "Map secret visibility and approvals to team-scoped permissions.",
    header: <AccessVisual />,
    icon: <Users className="h-4 w-4 text-primary" />,
    className: "md:col-span-2",
  },
  {
    title: "Key lifecycle",
    description: "Issue, rotate, expire, and renew keys in one operational flow.",
    header: <LifecycleVisual />,
    icon: <Lock className="h-4 w-4 text-primary" />,
    className: "md:col-span-1",
  },
];

const Features = () => {
  return (
    <section id="features" className="container mx-auto px-4 md:px-8 py-16 md:py-24">
      <div className="grid gap-0 lg:grid-cols-[0.76fr_1.24fr]">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.35 }}
          className="relative overflow-hidden border border-border bg-[hsl(var(--surface-1))] p-6 md:p-8"
        >
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 opacity-45"
            style={{
              backgroundImage:
                "linear-gradient(hsl(var(--border) / 0.7) 1px, transparent 1px), linear-gradient(90deg, hsl(var(--border) / 0.7) 1px, transparent 1px)",
              backgroundSize: "36px 36px",
            }}
          />
          <div className="relative z-10">
            <div className="mb-4 inline-flex items-center gap-2 border border-border bg-[hsl(var(--surface-2))] px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              Operational capability
            </div>
            <h2 className="max-w-sm text-3xl font-bold leading-tight text-foreground md:text-4xl">
              Ship through approvals, drift control, and secure runtime sync.
            </h2>
            <p className="mt-4 max-w-sm text-base leading-relaxed text-muted-foreground">
              The controls here matter when config moves through dev, staging, CI, and production.
            </p>
          </div>
        </motion.div>

        <div className="min-w-0">
          <BentoGrid className="md:auto-rows-[16rem]">
            {features.map((feature, i) => (
              <BentoGridItem
                key={i}
                title={feature.title}
                description={feature.description}
                header={feature.header}
                icon={feature.icon}
                className={feature.className}
              />
            ))}
          </BentoGrid>
        </div>
      </div>
    </section>
  );
};

export default Features;
