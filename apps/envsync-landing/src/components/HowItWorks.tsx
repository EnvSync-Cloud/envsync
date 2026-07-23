import { GitPullRequestArrow, ShieldCheck, Terminal, Workflow } from "lucide-react";

const steps = [
  {
    number: "01",
    icon: Terminal,
    title: "Connect",
    command: "envsync auth login && envsync init",
    result: "Bind repo and app",
  },
  {
    number: "02",
    icon: Workflow,
    title: "Push",
    command: "envsync push --env staging",
    result: "Create a reviewed change set",
  },
  {
    number: "03",
    icon: GitPullRequestArrow,
    title: "Approve",
    command: "envsync push --env production --strict",
    result: "Gate prod with policy",
  },
  {
    number: "04",
    icon: ShieldCheck,
    title: "Inject",
    command: "envsync pull --env production",
    result: "Sync CI or runtime",
  },
];

const HowItWorks = () => {
  return (
    <section className="container mx-auto px-4 md:px-8 py-16 md:py-24">
      <div className="grid gap-0 lg:grid-cols-[0.78fr_1.22fr]">
        <div className="border border-border bg-[hsl(var(--surface-1))] p-6 md:p-8">
          <div className="mb-4 inline-flex items-center gap-2 border border-border bg-[hsl(var(--surface-2))] px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            Workflow
          </div>
          <h2 className="max-w-sm text-3xl font-bold leading-tight text-foreground md:text-4xl">
            Move from local edits to runtime-safe delivery in one path.
          </h2>
          <p className="mt-4 max-w-sm text-base leading-relaxed text-muted-foreground">
            Connect, push, approve, and inject without inventing a new team ritual.
          </p>
        </div>

        <div className="relative overflow-hidden border border-border bg-[linear-gradient(180deg,hsl(var(--surface-1)),#0a0f15)] p-5 md:p-6">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 opacity-35"
            style={{
              backgroundImage:
                "linear-gradient(hsl(var(--border) / 0.45) 1px, transparent 1px), linear-gradient(90deg, hsl(var(--border) / 0.45) 1px, transparent 1px)",
              backgroundSize: "24px 24px",
            }}
          />
          <div className="relative z-10">
            <div className="pointer-events-none absolute left-8 right-8 top-10 hidden h-px bg-border md:block" />
            <div className="grid gap-4 md:grid-cols-4">
              {steps.map((step) => (
                <div key={step.number} className="relative">
                  <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full border border-border bg-[hsl(var(--surface-2))]">
                    <step.icon className="h-5 w-5 text-primary" />
                  </div>

                  <div className="rounded-[1.1rem] border border-border bg-[hsl(var(--surface-1))/0.95] p-4">
                    <div className="mb-3 flex items-center justify-between">
                      <h3 className="text-lg font-semibold text-foreground">{step.title}</h3>
                      <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-primary">{step.number}</span>
                    </div>
                    <div className="rounded-xl border border-border bg-[#091019] px-3 py-2 font-mono text-[11px] text-foreground">
                      <span className="text-primary">$</span> {step.command}
                    </div>
                    <p className="mt-3 text-sm text-muted-foreground">{step.result}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default HowItWorks;
