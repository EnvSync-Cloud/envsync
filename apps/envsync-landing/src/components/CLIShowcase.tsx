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
    <section className="py-24 bg-gradient-to-b from-slate-800 to-slate-900 relative overflow-hidden">
      {/* Grid overlay */}
      <div className="absolute inset-0 bg-grid-white/[0.02] bg-[size:40px_40px]" />

      <div className="relative container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-4xl md:text-5xl font-bold text-white mb-6">
            A CLI that{" "}
            <span className="bg-gradient-to-r from-emerald-400 to-blue-400 bg-clip-text text-transparent">
              just works
            </span>
          </h2>
          <p className="text-xl text-slate-300 max-w-2xl mx-auto">
            Manage secrets from your terminal with intuitive commands. No context
            switching, no browser tabs.
          </p>
        </div>

        {/* Terminal card */}
        <div className="max-w-3xl mx-auto">
          <div className="bg-slate-950 border border-slate-700 rounded-xl overflow-hidden shadow-2xl">
            {/* macOS title bar */}
            <div className="flex items-center space-x-2 px-4 py-3 bg-slate-900 border-b border-slate-700">
              <div className="w-3 h-3 rounded-full bg-red-500" />
              <div className="w-3 h-3 rounded-full bg-yellow-500" />
              <div className="w-3 h-3 rounded-full bg-green-500" />
              <span className="ml-4 text-sm text-slate-500 font-mono">
                terminal
              </span>
            </div>

            {/* Terminal body */}
            <div className="p-6 font-mono text-sm leading-relaxed">
              {lines.map((line, i) => (
                <div key={i} className="min-h-[1.5em]">
                  {line.type === "command" && (
                    <span className="text-emerald-400">{line.text}</span>
                  )}
                  {line.type === "output" && (
                    <span className="text-slate-300">{line.text}</span>
                  )}
                  {line.type === "comment" && (
                    <span className="text-slate-500 italic">{line.text}</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default CLIShowcase;
