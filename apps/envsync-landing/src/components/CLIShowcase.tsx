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
    <section className="container mx-auto border-x border-t border-border py-20 md:py-24">
      <div className="relative container mx-auto px-0 z-10">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.35 }}
          className="mb-14 text-center"
        >
          <h2 className="mb-5 text-4xl font-bold text-foreground md:text-5xl">
            A CLI that just works
          </h2>
          <p className="mx-auto max-w-2xl text-lg text-muted-foreground md:text-xl">
            Operate secrets where you already ship: your terminal.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.35, delay: 0.1 }}
          className="grid w-full grid-cols-1 gap-0 lg:grid-cols-[2fr_1fr]"
        >
          <div className="overflow-hidden border border-border bg-[hsl(var(--surface-1))]">
            <div className="flex items-center justify-between border-b border-border bg-[hsl(var(--surface-2))] px-4 py-3">
              <div className="flex space-x-2">
                <div className="h-2.5 w-2.5 border border-border" />
                <div className="h-2.5 w-2.5 border border-border" />
                <div className="h-2.5 w-2.5 border border-border" />
              </div>
              <span className="font-mono text-xs tracking-wider text-muted-foreground">
                bash — envsync
              </span>
              <div className="w-12" />
            </div>

            <div className="bg-[hsl(var(--surface-1))] p-6 font-mono text-sm leading-relaxed md:p-8 md:text-base">
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
                    <span className="font-medium text-primary">{line.text}</span>
                  )}
                  {line.type === "output" && (
                    <span className="text-foreground">{line.text}</span>
                  )}
                  {line.type === "comment" && (
                    <span className="italic text-muted-foreground">{line.text}</span>
                  )}
                </motion.div>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-0 lg:grid-cols-1">
            <div className="border border-border bg-[hsl(var(--surface-1))] p-4">
              <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Latency</p>
              <p className="mt-2 text-2xl font-semibold text-foreground">~120ms</p>
            </div>
            <div className="border border-border bg-[hsl(var(--surface-1))] p-4">
              <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Secrets synced</p>
              <p className="mt-2 text-2xl font-semibold text-foreground">1,500+</p>
            </div>
            <div className="col-span-2 border border-border bg-[hsl(var(--surface-1))] p-4 lg:col-span-1">
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
