import { Shield, Zap, Globe, GitBranch, Users, Lock } from "lucide-react";
import { BentoGrid, BentoGridItem } from "./ui/bento-grid";
import { motion } from "framer-motion";

const SkeletonOne = () => (
  <div className="flex flex-1 w-full h-full min-h-[6rem] rounded-xl bg-gradient-to-br from-slate-900 to-slate-800 border border-white/[0.05] p-4 overflow-hidden relative group/skeleton">
    <div className="flex flex-col gap-2">
      <div className="h-4 w-24 bg-emerald-500/20 rounded-full animate-pulse" />
      <div className="h-3 w-32 bg-white/5 rounded-full" />
      <div className="h-3 w-28 bg-white/5 rounded-full" />
    </div>
    <div className="absolute -bottom-4 -right-4 w-24 h-24 bg-emerald-500/10 rounded-full blur-2xl group-hover/skeleton:bg-emerald-500/20 transition-colors" />
  </div>
);

const SkeletonTwo = () => (
  <div className="flex flex-1 w-full h-full min-h-[6rem] rounded-xl bg-gradient-to-br from-slate-900 to-slate-800 border border-white/[0.05] p-4 overflow-hidden relative group/skeleton">
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <div className="h-4 w-4 rounded bg-emerald-500/20" />
        <div className="h-2 w-16 bg-white/5 rounded-full" />
      </div>
      <div className="flex items-center gap-2">
        <div className="h-4 w-4 rounded bg-emerald-500/20" />
        <div className="h-2 w-20 bg-white/5 rounded-full" />
      </div>
    </div>
  </div>
);

const SkeletonThree = () => (
  <div className="flex flex-1 w-full h-full min-h-[6rem] rounded-xl bg-gradient-to-br from-slate-900 to-slate-800 border border-white/[0.05] p-4 overflow-hidden relative group/skeleton">
    <div className="flex flex-col gap-2">
      <div className="h-4 w-32 bg-emerald-500/20 rounded-full" />
      <div className="flex gap-1">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-2 w-8 bg-white/5 rounded-full" />
        ))}
      </div>
    </div>
  </div>
);

const SkeletonFour = () => (
  <div className="flex flex-1 w-full h-full min-h-[6rem] rounded-xl bg-gradient-to-br from-slate-900 to-slate-800 border border-white/[0.05] p-4 overflow-hidden relative group/skeleton">
    <div className="flex items-center justify-between h-full">
      <div className="flex flex-col gap-2">
        <div className="h-4 w-24 bg-emerald-500/20 rounded-full" />
        <div className="h-3 w-32 bg-white/5 rounded-full" />
        <div className="h-3 w-20 bg-white/5 rounded-full" />
      </div>
      <div className="flex flex-col gap-1 items-end">
        <div className="h-2 w-16 bg-emerald-500/10 rounded-full" />
        <div className="h-2 w-12 bg-emerald-500/10 rounded-full" />
        <div className="h-2 w-20 bg-emerald-500/20 rounded-full" />
      </div>
    </div>
  </div>
);

const SkeletonFive = () => (
  <div className="flex flex-1 w-full h-full min-h-[6rem] rounded-xl bg-gradient-to-br from-slate-900 to-slate-800 border border-white/[0.05] p-4 overflow-hidden relative group/skeleton">
    <div className="flex flex-col gap-2">
      <div className="h-8 w-full bg-white/5 rounded-lg border border-white/[0.05]" />
      <div className="flex gap-2">
        <div className="h-10 w-10 rounded bg-emerald-500/10 border border-emerald-500/20" />
        <div className="h-10 w-full rounded bg-white/5 border border-white/[0.05]" />
      </div>
    </div>
  </div>
);

const SkeletonSix = () => (
  <div className="flex flex-1 w-full h-full min-h-[6rem] rounded-xl bg-gradient-to-br from-slate-900 to-slate-800 border border-white/[0.05] p-4 overflow-hidden relative group/skeleton">
    <div className="flex flex-col justify-center items-center h-full">
      <div className="h-2 w-full bg-white/5 rounded-full overflow-hidden">
        <motion.div 
          initial={{ width: "0%" }}
          whileInView={{ width: "70%" }}
          transition={{ duration: 2, repeat: Infinity }}
          className="h-full bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]"
        />
      </div>
    </div>
  </div>
);

const features = [
  {
    title: "Military-grade encryption",
    description: "End-to-end encryption with AES-256 and zero-knowledge architecture. Your secrets are always protected.",
    header: <SkeletonOne />,
    icon: <Shield className="h-4 w-4 text-emerald-500" />,
    className: "md:col-span-2",
  },
  {
    title: "Lightning fast sync",
    description: "Deploy configuration changes across all environments in seconds.",
    header: <SkeletonTwo />,
    icon: <Zap className="h-4 w-4 text-emerald-500" />,
    className: "md:col-span-1",
  },
  {
    title: "Multi-environment",
    description: "Manage development, staging, and production environments with granular access controls.",
    header: <SkeletonThree />,
    icon: <Globe className="h-4 w-4 text-emerald-500" />,
    className: "md:col-span-1",
  },
  {
    title: "Git-like workflows",
    description: "Version control for your configurations with branching, merging, and full rollback capabilities.",
    header: <SkeletonFour />,
    icon: <GitBranch className="h-4 w-4 text-emerald-500" />,
    className: "md:col-span-2",
  },
  {
    title: "Team collaboration",
    description: "Share secrets securely with team members using strict role-based permissions.",
    header: <SkeletonFive />,
    icon: <Users className="h-4 w-4 text-emerald-500" />,
    className: "md:col-span-2",
  },
  {
    title: "Secrets management lifecycle",
    description: "Manage GPG keys and certificates easily.",
    header: <SkeletonSix />,
    icon: <Lock className="h-4 w-4 text-emerald-500" />,
    className: "md:col-span-1",
  },
];

const Features = () => {
  return (
    <section id="features" className="py-32 bg-slate-950 relative overflow-hidden">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="text-center mb-16"
        >
          <h2 className="text-4xl md:text-5xl font-bold text-white mb-6">
            Everything you need to <br/>
            <span className="bg-gradient-to-r from-emerald-400 to-blue-400 bg-clip-text text-transparent">
              secure your secrets
            </span>
          </h2>
          <p className="text-xl text-neutral-400 max-w-3xl mx-auto font-light">
            Built by developers, for developers. EnvSync provides all the tools you need 
            to manage environment variables and secrets at scale.
          </p>
        </motion.div>
        
        <BentoGrid className="max-w-6xl mx-auto">
          {features.map((feature, i) => (
            <BentoGridItem
              key={i}
              title={feature.title}
              description={feature.description}
              header={feature.header}
              icon={feature.icon}
              className={feature.className + " border-white/[0.1] bg-slate-900/50 hover:bg-slate-900/80 backdrop-blur-sm shadow-xl"}
            />
          ))}
        </BentoGrid>

      </div>
    </section>
  );
};

export default Features;
