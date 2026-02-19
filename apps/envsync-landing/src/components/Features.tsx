
import { Shield, Zap, Globe, GitBranch, Users, Lock } from "lucide-react";

const features = [
  {
    icon: Shield,
    title: "Military-grade encryption",
    description: "End-to-end encryption with AES-256 and zero-knowledge architecture. Your secrets are always protected."
  },
  {
    icon: Zap,
    title: "Lightning fast sync",
    description: "Deploy configuration changes across all environments in seconds, not minutes. Built for speed."
  },
  {
    icon: Globe,
    title: "Multi-environment",
    description: "Manage development, staging, and production environments with granular access controls."
  },
  {
    icon: GitBranch,
    title: "Git-like workflows",
    description: "Version control for your configurations with branching, merging, and rollback capabilities."
  },
  {
    icon: Users,
    title: "Team collaboration",
    description: "Share secrets securely with team members using role-based permissions and audit logs."
  },
  {
    icon: Lock,
    title: "Secrets management",
    description: "Manage GPG keys, certificates, and encrypted secrets throughout their entire lifecycle with ease."
  }
];

const Features = () => {
  return (
    <section id="features" className="py-24 bg-slate-900">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-4xl md:text-5xl font-bold text-white mb-6">
            Everything you need to
            <br />
            <span className="bg-gradient-to-r from-emerald-400 to-blue-400 bg-clip-text text-transparent">
              secure your secrets
            </span>
          </h2>
          <p className="text-xl text-slate-300 max-w-3xl mx-auto">
            Built by developers, for developers. EnvSync provides all the tools you need 
            to manage environment variables and secrets at scale.
          </p>
        </div>
        
        <div className="flex flex-wrap justify-center gap-8">
          {features.map((feature, index) => (
            <div 
              key={index}
              className="group relative bg-slate-800/50 backdrop-blur-sm border border-slate-700 rounded-2xl p-8 hover:bg-slate-800/80 transition-all duration-300 hover:scale-105 w-full md:w-80 lg:w-96"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/5 to-blue-500/5 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
              <div className="relative">
                <div className="w-12 h-12 bg-emerald-500/20 rounded-xl flex items-center justify-center mb-6 group-hover:bg-emerald-500/30 transition-colors">
                  <feature.icon className="h-6 w-6 text-emerald-400" />
                </div>
                <h3 className="text-xl font-semibold text-white mb-4">{feature.title}</h3>
                <p className="text-slate-300 leading-relaxed">{feature.description}</p>
              </div>
            </div>
          ))}
        </div>

      </div>
    </section>
  );
};

export default Features;
