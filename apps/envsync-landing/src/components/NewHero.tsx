import { Button } from "@/components/primitives/Button"
import { CropMarkFrame } from "@/components/primitives/CropMarkFrame"
import { DotTexture } from "@/components/primitives/DotTexture"
import { Terminal, type TerminalLine } from "@/components/primitives/Terminal"
import { Github } from "lucide-react"
import { Link } from "react-router-dom"
import { VERSION } from "./Footer"

const terminalLines: TerminalLine[] = [
  { type: "cmd", text: "envsync pull --env staging" },
  { type: "success", text: "Synced 12 values from staging" },
  { type: "cmd", text: "envsync push --env production --strict" },
  { type: "warn", text: "Approval required before prod sync" },
  { type: "cmd", text: "envsync request approve --id cr_abc123" },
  { type: "success", text: "Approved and deployed to production" },
]

const NewHero = () => {
  return (
    <section className="bg-background px-2 pt-2 md:px-3 md:pt-3">
      {/* Green accent canvas — theme-invariant */}
      <div className="relative overflow-hidden rounded-lg bg-primary">
        {/* Dot texture + bottom radial glow */}
        <DotTexture />

        {/* Content */}
        <div className="relative z-10 mx-auto flex max-w-[1080px] flex-col items-center px-6 pb-40 pt-24 text-center md:pb-48 md:pt-32">
          {/* Announcement pill — on-canvas variant */}
          <div className="flex items-center gap-2 rounded-full border border-hero-text/40 px-4 py-1.5 text-sm text-hero-text">
            <span
              className="h-2 w-2 rounded-full bg-hero-text animate-pulse"
              aria-hidden="true"
            />
            Now in public beta
            <span className="font-mono text-mono-label" aria-hidden="true">
              ·
            </span>
            <span className="font-mono text-mono-label">{VERSION}</span>
          </div>

          {/* Headline */}
          <h1 className="mt-8 max-w-4xl text-balance text-[clamp(2.25rem,6vw,3.5rem)] font-medium leading-none tracking-[-1.4px] text-hero-text">
            Ship environment variables without the drift.
          </h1>

          {/* Sub-lead */}
          <p className="mt-6 max-w-2xl text-lead text-hero-text/85">
            CLI-first secrets and config delivery for dev, staging, CI, and
            production. Pull, push, approve — no more .env file chaos.
          </p>

          {/* CTA row */}
          <div className="mt-10 flex flex-col items-center gap-4 sm:flex-row">
            <Link to="/onboarding">
              <Button variant="hero" size="lg">
                Start for free
              </Button>
            </Link>
            <a href="https://github.com/EnvSync-Cloud/envsync">
              <Button
                variant="hero"
                size="lg"
                className="border-hero-text bg-transparent text-hero-text hover:opacity-95"
              >
                <Github className="h-4 w-4" />
                View on GitHub
              </Button>
            </a>
          </div>
        </div>
      </div>

      {/* Terminal overlap — outside canvas, above the bottom edge */}
      <div className="relative z-20 mx-auto -mt-24 max-w-3xl px-4 sm:px-0 md:-mt-32">
        <CropMarkFrame color="hsl(var(--primary))">
          <Terminal title="envsync — cli" lines={terminalLines} />
        </CropMarkFrame>
      </div>

      {/* Breathing room before next section */}
      <div className="h-16 md:h-24" />
    </section>
  )
}

export default NewHero
