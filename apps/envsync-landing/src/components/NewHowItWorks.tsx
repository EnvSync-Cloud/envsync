import { SectionHeading } from "@/components/primitives/SectionHeading"
import { CropMarkFrame } from "@/components/primitives/CropMarkFrame"

const steps = [
  {
    number: "01",
    title: "Connect",
    command: "envsync auth login && envsync init",
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
]

const NewHowItWorks = () => {
  return (
    <section className="border-t border-border bg-background bg-grid-box">
      <div className="mx-auto max-w-[1280px] px-4 py-16 sm:px-8 md:py-24">
        <SectionHeading
          align="center"
          eyebrow="CLI"
          title="Three commands. Zero drift."
          description="From local dev to production in three steps. No GUI required."
        />

        <div className="mt-16 grid gap-8 md:grid-cols-3">
          {steps.map((step) => (
            <div key={step.number}>
              <span className="font-mono text-h2 font-medium text-accent-ink">
                {step.number}
              </span>
              <h3 className="mt-2 text-h3 font-medium text-foreground">
                {step.title}
              </h3>
              <p className="mt-2 text-sm text-muted-foreground">
                {step.description}
              </p>
              <div className="mt-4">
                <CropMarkFrame>
                  <div className="rounded-lg border border-border bg-card p-3 font-mono text-sm">
                    <span className="text-accent-ink">$</span>{" "}
                    <span className="text-foreground">{step.command}</span>
                  </div>
                </CropMarkFrame>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

export default NewHowItWorks
