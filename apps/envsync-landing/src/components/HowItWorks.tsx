import { Terminal, Upload, RefreshCw, ArrowRight } from "lucide-react";
import { motion } from "framer-motion";

const steps = [
  {
    number: 1,
    icon: Terminal,
    title: "Install the CLI",
    code: "npm install -g @envsync/cli",
  },
  {
    number: 2,
    icon: Upload,
    title: "Push your .env",
    code: "envsync push --env .env",
  },
  {
    number: 3,
    icon: RefreshCw,
    title: "Sync environments",
    code: "envsync pull --env production",
  },
];

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.2
    }
  }
};

const stepVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { 
    opacity: 1, 
    y: 0,
    transition: { duration: 0.5 }
  }
};

const HowItWorks = () => {
  return (
    <section className="py-32 bg-slate-950 relative border-t border-white/[0.05]">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="text-center mb-20"
        >
          <h2 className="text-4xl md:text-5xl font-bold text-white mb-6">
            Get started in{" "}
            <span className="bg-gradient-to-r from-emerald-400 to-blue-400 bg-clip-text text-transparent">
              three steps
            </span>
          </h2>
          <p className="text-xl text-neutral-400 max-w-2xl mx-auto font-light">
            From installation to syncing secrets across your team in under a
            minute.
          </p>
        </motion.div>

        <motion.div 
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          className="grid grid-cols-1 md:grid-cols-3 gap-8 items-start relative max-w-6xl mx-auto"
        >
          {steps.map((step, index) => (
            <motion.div variants={stepVariants} key={step.number} className="relative flex flex-col items-center text-center group">
              {/* Arrow between steps - hidden on mobile */}
              {index < steps.length - 1 && (
                <div className="hidden md:block absolute top-10 -right-4 translate-x-1/2 z-10">
                  <ArrowRight className="h-6 w-6 text-slate-800" />
                </div>
              )}

              {/* Numbered circle */}
              <div className="w-20 h-20 rounded-2xl bg-slate-900 border border-white/[0.1] shadow-xl flex items-center justify-center mb-8 group-hover:border-emerald-500/50 group-hover:bg-slate-800 transition-all duration-300">
                <step.icon className="h-8 w-8 text-emerald-400 group-hover:scale-110 transition-transform duration-300" />
              </div>

              {/* Step number badge */}
              <span className="text-xs font-bold tracking-wider uppercase text-emerald-500 mb-3">
                Step {step.number}
              </span>

              {/* Title */}
              <h3 className="text-2xl font-semibold text-white mb-6">
                {step.title}
              </h3>

              {/* Code mockup */}
              <div className="w-full bg-[#0d1117] border border-white/[0.05] shadow-2xl rounded-xl p-5 text-left relative overflow-hidden group-hover:border-white/[0.1] transition-colors">
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-emerald-500/0 via-emerald-500/50 to-emerald-500/0 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-2.5 h-2.5 rounded-full bg-slate-700"></div>
                  <div className="w-2.5 h-2.5 rounded-full bg-slate-700"></div>
                  <div className="w-2.5 h-2.5 rounded-full bg-slate-700"></div>
                </div>
                <code className="text-emerald-400 sm:text-xs md:text-sm font-mono block">
                  <span className="text-blue-400">$</span> {step.code}
                </code>
              </div>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
};

export default HowItWorks;
