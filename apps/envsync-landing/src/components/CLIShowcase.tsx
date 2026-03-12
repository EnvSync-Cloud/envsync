import { motion } from "framer-motion";

type TerminalLine = {
  type: "command" | "output" | "comment";
  text: string;
};

const lines: TerminalLine[] = [
  { type: "comment", text: "# Initialize EnvSync in your project" },
  { type: "command", text: "envsync init" },
  { type: "output", text: "Initialized EnvSync project in /my-app" },
  { type: "output", text: "Created .envsync.yaml configuration" },
  { type: "comment", text: "" },
  { type: "comment", text: "# Push local environment variables" },
  { type: "command", text: "envsync push --env .env" },
  { type: "output", text: "Encrypting 12 variables..." },
  { type: "output", text: "Pushed to development environment" },
  { type: "comment", text: "" },
  { type: "comment", text: "# Pull production secrets" },
  { type: "command", text: "envsync pull --env production" },
  { type: "output", text: "Decrypting 12 variables..." },
  { type: "output", text: "Written to .env.production" },
];

const CLIShowcase = () => {
  return (
    <section className="container mx-auto border-x border-t border-border p-0">
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
              A CLI that just works
            </h2>
            <p className="max-w-2xl text-lg text-muted-foreground md:text-xl">
              Operate secrets where you already ship: your terminal.
            </p>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.35, delay: 0.1 }}
          className="grid w-full grid-cols-1 gap-0 lg:grid-cols-[2fr_1fr]"
        >
          <div className="overflow-hidden border border-border bg-[hsl(var(--surface-1))]">
            <div className="flex items-center justify-between border-b border-border bg-[hsl(var(--surface-2))] px-4 py-2.5">
              <div className="flex space-x-2">
                <div className="h-2.5 w-2.5 border border-red-400/60 bg-red-400/20" />
                <div className="h-2.5 w-2.5 border border-amber-400/60 bg-amber-400/20" />
                <div className="h-2.5 w-2.5 border border-green-400/60 bg-green-400/20" />
              </div>
              <span className="font-mono text-xs tracking-wider text-muted-foreground/90">
                zsh — envsync-session
              </span>
              <span className="font-mono text-[11px] text-muted-foreground/80">ready</span>
            </div>

            <div className="relative bg-[#0b0f14] p-4 font-mono text-sm leading-relaxed md:p-6 md:text-[15px]">
              <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-0 opacity-10"
                style={{
                  backgroundImage:
                    "linear-gradient(hsl(var(--border) / 0.5) 1px, transparent 1px), linear-gradient(90deg, hsl(var(--border) / 0.5) 1px, transparent 1px)",
                  backgroundSize: "24px 24px",
                }}
              />
              <div className="relative z-10 space-y-0.5">
              {lines.map((line, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: -10 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: 0.2 + i * 0.04 }}
                  className="min-h-[1.5em]"
                >
                  {line.type === "command" && (
                    <>
                      <span className="text-primary">chirag@device</span>
                      <span className="text-slate-500">:</span>
                      <span className="ml-1 text-slate-400">~/my-app</span>
                      <span className="ml-2 text-primary">$</span>
                      <span className="ml-2 font-medium text-slate-100">{line.text}</span>
                    </>
                  )}
                  {line.type === "output" && <span className="text-slate-300/90">{line.text}</span>}
                  {line.type === "comment" && <span className="text-slate-500/90">{line.text}</span>}
                </motion.div>
              ))}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-0">
            <div className="border border-border bg-[hsl(var(--surface-1))] p-4">
              <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Latency</p>
              <p className="mt-2 text-2xl font-semibold text-foreground">~120ms</p>
            </div>
            <div className="-mt-px border border-border bg-[hsl(var(--surface-1))] p-4">
              <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Secrets synced</p>
              <p className="mt-2 text-2xl font-semibold text-foreground">1,500+</p>
            </div>
            <div className="-mt-px border border-border bg-[hsl(var(--surface-1))] p-4">
              <p className="mb-2 text-xs uppercase tracking-[0.16em] text-muted-foreground">Latest action</p>
              <p className="font-mono text-sm text-foreground">envsync push --env staging</p>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
};

export default CLIShowcase;
