import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { ArrowRight, Github, KeyRound, ShieldCheck, Terminal, Workflow } from "lucide-react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";

const terminalLines: { type: "command" | "output"; text: string }[] = [
  { type: "command", text: "envsync login" },
  { type: "output", text: "[ok] authenticated as team@envsync.cloud" },
  { type: "command", text: "envsync pull --env staging" },
  { type: "output", text: "[ok] wrote 12 vars to .env.staging" },
  { type: "command", text: "envsync push --env production --strict" },
  { type: "output", text: "[ok] synced 12 vars in 1.1s" },
];

const Hero = () => {
  const [visibleLines, setVisibleLines] = useState(0);
  const [cycle, setCycle] = useState(0);

  useEffect(() => {
    setVisibleLines(0);

    const revealDelay = 600;
    const revealTimer = setInterval(() => {
      setVisibleLines((prev) => {
        if (prev < terminalLines.length) {
          return prev + 1;
        }
        return prev;
      });
    }, revealDelay);

    const resetTimer = setTimeout(() => {
      setCycle((prev) => prev + 1);
    }, terminalLines.length * revealDelay + 1800);

    return () => {
      clearInterval(revealTimer);
      clearTimeout(resetTimer);
    };
  }, [cycle]);

  return (
    <section className="container mx-auto min-h-[100dvh] lg:h-screen border-x border-border p-0 pt-16 lg:pt-0">
      <div className="container mx-auto grid min-h-[calc(100dvh-5rem)] h-full grid-cols-1 gap-0 p-0 lg:grid-cols-2">
        <div className="relative flex flex-col justify-center overflow-hidden border border-border bg-[hsl(var(--surface-1))] px-10 py-16 pb-24">
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

            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, delay: 0.2 }}
              className="mb-5 text-4xl font-bold leading-[1.04] tracking-tight text-foreground sm:text-5xl md:text-6xl"
            >
              Shipping secure apps
              <br className="hidden sm:block" />
              <span className="text-primary">starts with controlled secrets.</span>
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, delay: 0.3 }}
              className="mb-7 max-w-xl text-lg leading-relaxed text-muted-foreground sm:text-xl"
            >
              EnvSync gives your team one source of truth for environment variables across development,
              staging, and production with audit-ready access control.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, delay: 0.4 }}
              className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row"
            >
              <Link to="/onboarding" className="w-full sm:w-auto">
                <Button size="lg" className="w-full px-8 text-base">
                  Get Started for Free
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
              <Link to="https://github.com/envsync-cloud" className="w-full sm:w-auto">
                <Button size="lg" variant="outline" className="w-full px-8 text-base">
                  <Github className="h-4 w-4" />
                  View on GitHub
                </Button>
              </Link>
            </motion.div>
          </div>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, delay: 0.5 }}
          className="grid grid-rows-[1fr_1fr] gap-0 lg:pt-16"
        >
          <div className="overflow-hidden border border-border bg-[#0b0f14]">
            <div className="flex items-center justify-between border-b border-border bg-[hsl(var(--surface-2))] px-4 py-2.5">
              <div className="flex space-x-2">
                <div className="h-2.5 w-2.5 border border-red-400/60 bg-red-400/20" />
                <div className="h-2.5 w-2.5 border border-amber-400/60 bg-amber-400/20" />
                <div className="h-2.5 w-2.5 border border-green-400/60 bg-green-400/20" />
              </div>
              <span className="font-mono text-xs tracking-wider text-muted-foreground/90">
                zsh — envsync-live
              </span>
              <span className="font-mono text-[11px] text-muted-foreground/80">running</span>
            </div>

            <div className="relative bg-[#0b0f14] p-4 font-mono text-sm leading-relaxed md:p-6 md:text-[15px]">
              <div className="relative z-10 space-y-1">
                {terminalLines.slice(0, visibleLines).map((line, index) => (
                  <motion.div
                    key={`${cycle}-${index}`}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.2 }}
                    className="min-h-[1.5em]"
                  >
                    {line.type === "command" ? (
                      <>
                        <span className="text-primary">user@device</span>
                        <span className="text-slate-500">:</span>
                        <span className="ml-1 text-slate-400">~/my-app</span>
                        <span className="ml-2 text-primary">$</span>
                        <span className="ml-2 text-slate-100">{line.text}</span>
                        {index === visibleLines - 1 && visibleLines < terminalLines.length && (
                          <span className="ml-1 inline-block h-4 w-2 animate-pulse bg-slate-200/70 align-middle" />
                        )}
                      </>
                    ) : (
                      <span className="text-slate-300/90">{line.text}</span>
                    )}
                  </motion.div>
                ))}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-0 h-full">
            <div className="col-span-2 border border-border bg-[hsl(var(--surface-1))] p-5">
              <p className="mb-2 text-xs uppercase tracking-[0.16em] text-muted-foreground">Deployment State</p>
              <p className="text-2xl font-semibold text-foreground">All environments in sync</p>
              <div className="mt-4 grid grid-cols-3 gap-2 text-sm">
                <div className="border border-border bg-[hsl(var(--surface-2))] p-2 text-center text-muted-foreground">dev</div>
                <div className="border border-primary/40 bg-[hsl(var(--surface-2))] p-2 text-center text-primary">staging</div>
                <div className="border border-border bg-[hsl(var(--surface-2))] p-2 text-center text-muted-foreground">prod</div>
              </div>
            </div>

            <div className="border border-border bg-[hsl(var(--surface-1))] p-4">
              <ShieldCheck className="mb-3 h-5 w-5 text-primary" />
              <p className="text-sm text-muted-foreground">Security</p>
              <p className="mt-1 text-lg font-semibold">End-to-end encrypted</p>
            </div>

            <div className="border border-border bg-[hsl(var(--surface-1))] p-4">
              <Workflow className="mb-3 h-5 w-5 text-primary" />
              <p className="text-sm text-muted-foreground">Workflow</p>
              <p className="mt-1 text-lg font-semibold">Versioned rollbacks</p>
            </div>

            <div className="border border-border bg-[hsl(var(--surface-1))] p-4">
              <KeyRound className="mb-3 h-5 w-5 text-primary" />
              <p className="text-sm text-muted-foreground">Secrets</p>
              <p className="mt-1 text-lg font-semibold">Centralized by app</p>
            </div>

            <div className="border border-border bg-[hsl(var(--surface-1))] p-4">
              <Terminal className="mb-3 h-5 w-5 text-primary" />
              <p className="text-sm text-muted-foreground">CLI</p>
              <p className="mt-1 font-mono text-sm text-foreground">envsync pull --env prod</p>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
};

export default Hero;
