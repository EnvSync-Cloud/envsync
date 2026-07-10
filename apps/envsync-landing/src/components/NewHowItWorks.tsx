const steps = [
  {
    number: "01",
    title: "Connect",
    command: "envsync login && envsync init",
    description: "Link your repo to EnvSync. One command to set up your project.",
  },
  {
    number: "02",
    title: "Push",
    command: "envsync push --env staging",
    description: "Send config to an environment. Changes are versioned and reviewable.",
  },
  {
    number: "03",
    title: "Deploy",
    command: "envsync pull --env production",
    description: "Pull approved config into CI or runtime. Safe, audited, instant.",
  },
];

const NewHowItWorks = () => {
  return (
    <section className="border-b border-border bg-background">
      <div className="container mx-auto px-4 py-24 md:px-8 md:py-32">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-bold tracking-tight text-foreground md:text-4xl">
            Three commands. Zero drift.
          </h2>
          <p className="mt-4 text-lg text-muted-foreground">
            From local dev to production in three steps. No GUI required.
          </p>
        </div>

        <div className="mx-auto mt-16 grid max-w-4xl gap-8 md:grid-cols-3">
          {steps.map((step) => (
            <div key={step.number} className="relative">
              <div className="text-6xl font-bold text-primary/10">{step.number}</div>
              <h3 className="mt-2 text-xl font-semibold text-foreground">{step.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{step.description}</p>
              <div className="mt-4 rounded-lg border border-border bg-background p-3 font-mono text-sm">
                <span className="text-primary">$</span> {step.command}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default NewHowItWorks;
