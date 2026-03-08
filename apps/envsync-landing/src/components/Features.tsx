import { Shield, Zap, Globe, GitBranch, Users, Lock } from "lucide-react";
import { BentoGrid, BentoGridItem } from "./ui/bento-grid";
import { motion } from "framer-motion";

const Skeleton = () => (
  <div className="flex flex-1 w-full h-full min-h-[6rem] rounded-xl bg-gradient-to-br from-neutral-200 dark:from-neutral-900 dark:to-neutral-800 to-neutral-100"></div>
);

const features = [
  {
    title: "Military-grade encryption",
    description: "End-to-end encryption with AES-256 and zero-knowledge architecture. Your secrets are always protected.",
    header: <Skeleton />,
    icon: <Shield className="h-4 w-4 text-emerald-500" />,
    className: "md:col-span-2",
  },
  {
    title: "Lightning fast sync",
    description: "Deploy configuration changes across all environments in seconds.",
    header: <Skeleton />,
    icon: <Zap className="h-4 w-4 text-emerald-500" />,
    className: "md:col-span-1",
  },
  {
    title: "Multi-environment",
    description: "Manage development, staging, and production environments with granular access controls.",
    header: <Skeleton />,
    icon: <Globe className="h-4 w-4 text-emerald-500" />,
    className: "md:col-span-1",
  },
  {
    title: "Git-like workflows",
    description: "Version control for your configurations with branching, merging, and full rollback capabilities.",
    header: <Skeleton />,
    icon: <GitBranch className="h-4 w-4 text-emerald-500" />,
    className: "md:col-span-2",
  },
  {
    title: "Team collaboration",
    description: "Share secrets securely with team members using strict role-based permissions.",
    header: <Skeleton />,
    icon: <Users className="h-4 w-4 text-emerald-500" />,
    className: "md:col-span-2",
  },
  {
    title: "Secrets management lifecycle",
    description: "Manage GPG keys and certificates easily.",
    header: <Skeleton />,
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
