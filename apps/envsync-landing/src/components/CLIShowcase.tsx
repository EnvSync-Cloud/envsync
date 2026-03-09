import { motion } from "framer-motion";

const lines: { type: "command" | "output" | "comment"; text: string }[] = [
  { type: "comment", text: "# Initialize EnvSync in your project" },
  { type: "command", text: "$ envsync init" },
  { type: "output", text: "Initialized EnvSync project in /my-app" },
  { type: "output", text: "Created .envsync.yaml configuration" },
  { type: "comment", text: "" },
  { type: "comment", text: "# Push local environment variables" },
  { type: "command", text: "$ envsync push --env .env" },
  { type: "output", text: "Encrypting 12 variables..." },
  { type: "output", text: "Pushed to development environment" },
  { type: "comment", text: "" },
  { type: "comment", text: "# Pull production secrets" },
  { type: "command", text: "$ envsync pull --env production" },
  { type: "output", text: "Decrypting 12 variables..." },
  { type: "output", text: "Written to .env.production" },
];

const CLIShowcase = () => {
  return (
    <section className="py-32 bg-slate-950 relative overflow-hidden border-t border-white/[0.05]">
      {/* Grid overlay */}
      <div className="absolute inset-0 bg-grid-white/[0.02] bg-[size:40px_40px] pointer-events-none" />

      <div className="relative container mx-auto px-4 sm:px-6 lg:px-8 z-10">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="text-center mb-16"
        >
          <h2 className="text-4xl md:text-5xl font-bold text-white mb-6">
            A CLI that{" "}
            <span className="bg-gradient-to-r from-emerald-400 to-blue-400 bg-clip-text text-transparent">
              just works
            </span>
          </h2>
          <p className="text-xl text-neutral-400 max-w-2xl mx-auto font-light">
            Manage secrets from your terminal with intuitive commands. No context
            switching, no browser tabs.
          </p>
        </motion.div>

        {/* Terminal card */}
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="max-w-3xl mx-auto"
        >
          <div className="bg-[#0d1117] border border-white/[0.1] rounded-2xl overflow-hidden shadow-2xl">
            {/* macOS title bar */}
            <div className="flex items-center justify-between px-4 py-3 bg-[#161b22] border-b border-white/[0.05]">
              <div className="flex space-x-2">
                <div className="w-3 h-3 rounded-full bg-red-500/80" />
                <div className="w-3 h-3 rounded-full bg-yellow-500/80" />
                <div className="w-3 h-3 rounded-full bg-green-500/80" />
              </div>
              <span className="text-xs text-neutral-500 font-mono tracking-wider">
                bash — envsync
              </span>
              <div className="w-12"></div> {/* Spacer for centering */}
            </div>

            {/* Terminal body */}
            <div className="p-6 md:p-8 font-mono text-sm md:text-base leading-relaxed bg-[#0d1117]">
              {lines.map((line, i) => (
                <motion.div 
                  key={i} 
                  initial={{ opacity: 0, x: -10 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: 0.3 + i * 0.05 }}
                  className="min-h-[1.5em]"
                >
                  {line.type === "command" && (
                    <span className="text-emerald-400 font-medium">{line.text}</span>
                  )}
                  {line.type === "output" && (
                    <span className="text-neutral-300">{line.text}</span>
                  )}
                  {line.type === "comment" && (
                    <span className="text-neutral-500 italic">{line.text}</span>
                  )}
                </motion.div>
              ))}
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
};

export default CLIShowcase;
