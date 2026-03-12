import { Shield, Zap, Globe, GitBranch, Users, Lock } from "lucide-react";
import { BentoGrid, BentoGridItem } from "./ui/bento-grid";
import { motion } from "framer-motion";

const SkeletonOne = () => (
  <div className="group/skeleton relative flex h-full min-h-[6rem] w-full flex-1 overflow-hidden border border-border bg-[hsl(var(--surface-2))] p-4">
    <div className="flex flex-col gap-2">
      <div className="h-4 w-24 bg-primary/20" />
      <div className="h-3 w-32 bg-foreground/10" />
      <div className="h-3 w-28 bg-foreground/10" />
    </div>
    <div className="absolute inset-y-0 right-0 w-1 bg-primary/30 transition-colors group-hover/skeleton:bg-primary" />
  </div>
);

const SkeletonTwo = () => (
  <div className="relative flex h-full min-h-[6rem] w-full flex-1 overflow-hidden border border-border bg-[hsl(var(--surface-2))] p-4">
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <div className="h-4 w-4 bg-primary/20" />
        <div className="h-2 w-16 bg-foreground/10" />
      </div>
      <div className="flex items-center gap-2">
        <div className="h-4 w-4 bg-primary/20" />
        <div className="h-2 w-20 bg-foreground/10" />
      </div>
    </div>
  </div>
);

const SkeletonThree = () => (
  <div className="relative flex h-full min-h-[6rem] w-full flex-1 overflow-hidden border border-border bg-[hsl(var(--surface-2))] p-4">
    <div className="flex flex-col gap-2">
      <div className="h-4 w-32 bg-primary/20" />
      <div className="flex gap-1">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-2 w-8 bg-foreground/10" />
        ))}
      </div>
    </div>
  </div>
);

const SkeletonFour = () => (
  <div className="relative flex h-full min-h-[6rem] w-full flex-1 overflow-hidden border border-border bg-[hsl(var(--surface-2))] p-4">
    <div className="flex items-center justify-between h-full">
      <div className="flex flex-col gap-2">
        <div className="h-4 w-24 bg-primary/20" />
        <div className="h-3 w-32 bg-foreground/10" />
        <div className="h-3 w-20 bg-foreground/10" />
      </div>
      <div className="flex flex-col gap-1 items-end">
        <div className="h-2 w-16 bg-primary/15" />
        <div className="h-2 w-12 bg-primary/15" />
        <div className="h-2 w-20 bg-primary/30" />
      </div>
    </div>
  </div>
);

const SkeletonFive = () => (
  <div className="relative flex h-full min-h-[6rem] w-full flex-1 overflow-hidden border border-border bg-[hsl(var(--surface-2))] p-4">
    <div className="flex flex-col gap-2">
      <div className="h-8 w-full border border-border bg-foreground/10" />
      <div className="flex gap-2">
        <div className="h-10 w-10 border border-primary/40 bg-primary/15" />
        <div className="h-10 w-full border border-border bg-foreground/10" />
      </div>
    </div>
  </div>
);

const SkeletonSix = () => (
  <div className="relative flex h-full min-h-[6rem] w-full flex-1 overflow-hidden border border-border bg-[hsl(var(--surface-2))] p-4">
    <div className="flex flex-col justify-center items-center h-full">
      <div className="h-2 w-full overflow-hidden bg-foreground/10">
        <motion.div
          initial={{ width: "0%" }}
          whileInView={{ width: "70%" }}
          transition={{ duration: 2, repeat: Infinity }}
          className="h-full bg-primary"
        />
      </div>
    </div>
  </div>
);

const features = [
  {
    title: "End-to-end encryption",
    description: "AES-256 with a zero-knowledge model keeps plaintext out of places it should never be.",
    header: <SkeletonOne />,
    icon: <Shield className="h-4 w-4 text-primary" />,
    className: "md:col-span-2",
  },
  {
    title: "Fast sync",
    description: "Ship config updates across environments in seconds, not deployment windows.",
    header: <SkeletonTwo />,
    icon: <Zap className="h-4 w-4 text-primary" />,
    className: "md:col-span-1",
  },
  {
    title: "Multi-environment control",
    description: "Operate dev, staging, and production with the same policy and approval surface.",
    header: <SkeletonThree />,
    icon: <Globe className="h-4 w-4 text-primary" />,
    className: "md:col-span-1",
  },
  {
    title: "Versioned workflows",
    description: "Track every config change with history, diff visibility, and rollback support.",
    header: <SkeletonFour />,
    icon: <GitBranch className="h-4 w-4 text-primary" />,
    className: "md:col-span-2",
  },
  {
    title: "Team-level access",
    description: "Control secret visibility with scoped permissions mapped to your org structure.",
    header: <SkeletonFive />,
    icon: <Users className="h-4 w-4 text-primary" />,
    className: "md:col-span-2",
  },
  {
    title: "Key lifecycle",
    description: "Manage certificates and signing keys in one operational workflow.",
    header: <SkeletonSix />,
    icon: <Lock className="h-4 w-4 text-primary" />,
    className: "md:col-span-1",
  },
];

const Features = () => {
  return (
    <section id="features" className="container mx-auto border-x border-t border-border py-0 px-0">
      <div className="relative container mx-auto px-0 z-10">

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.35 }}
          className="relative overflow-hidden border border-border bg-[hsl(var(--surface-1))] p-6 text-left md:p-8 md:py-12"
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
            <h2 className="mb-4 text-4xl font-bold text-foreground md:text-5xl">
              Everything you need to secure your secrets
            </h2>
            <p className="max-w-3xl text-lg text-muted-foreground md:text-xl">
              Built for teams shipping across multiple stages with strict security and fast release cycles.
            </p>
          </div>
        </motion.div>

        <BentoGrid>
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
    </section>
  );
};

export default Features;
