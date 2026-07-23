import * as React from "react"
import {
  Button,
  AnnouncementPill,
  Card,
  CropMarkFrame,
  SectionHeading,
  StatCallout,
  Terminal,
  TabPills,
  LogoCell,
  SplitPanel,
  BeamCard,
  ThemeToggle,
} from "@/components/primitives"
import { Zap, Shield, GitBranch, Globe, Lock, Server } from "lucide-react"

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

const Section = ({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) => (
  <section className="space-y-6">
    <h3 className="font-mono text-mono-label text-accent-ink">{title}</h3>
    {children}
  </section>
)

const Row = ({
  label,
  children,
}: {
  label?: string
  children: React.ReactNode
}) => (
  <div className="space-y-2">
    {label && (
      <span className="font-mono text-xs text-muted-foreground">{label}</span>
    )}
    <div className="flex items-center gap-4 flex-wrap">{children}</div>
  </div>
)

/* ------------------------------------------------------------------ */
/* Terminal demo data                                                  */
/* ------------------------------------------------------------------ */

const terminalLines = [
  { type: "cmd" as const, text: "envsync pull --env production" },
  { type: "info" as const, text: "Connecting to api.envsync.cloud..." },
  { type: "success" as const, text: "12 secrets pulled into .env.production" },
  { type: "warn" as const, text: "2 secrets expire in < 48 hours" },
  { type: "cmd" as const, text: "envsync push --env staging" },
  { type: "success" as const, text: "3 variables pushed to staging" },
]

/* ------------------------------------------------------------------ */
/* Tab demo data                                                       */
/* ------------------------------------------------------------------ */

const demoTabs = [
  { id: "overview", label: "Overview", icon: Zap },
  { id: "security", label: "Security", icon: Shield },
  { id: "integrations", label: "Integrations", icon: GitBranch },
]

/* ------------------------------------------------------------------ */
/* Component                                                           */
/* ------------------------------------------------------------------ */

export default function Showcase() {
  const [activeTab, setActiveTab] = React.useState("overview")

  return (
    <div className="bg-background min-h-screen">
      <div className="max-w-[1080px] mx-auto py-16 px-4 space-y-16">
        {/* ── Header ──────────────────────────────────────────────── */}
        <header className="flex items-center justify-between">
          <h1 className="text-h1 font-medium">Primitive Showcase</h1>
          <ThemeToggle />
        </header>

        {/* ── Contrast Swatches ───────────────────────────────────── */}
        <Section title="Contrast Swatches (both themes)">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Light */}
            <div className="p-6 rounded-lg border border-border bg-white space-y-3">
              <span className="font-mono text-mono-label text-muted-foreground">
                Light
              </span>
              <p className="text-accent-ink font-medium">
                accent-ink on white
              </p>
              <div className="bg-primary p-3 rounded-md">
                <p className="text-primary-foreground font-medium">
                  primary-foreground on primary
                </p>
              </div>
            </div>
            {/* Dark (forced via .dark ancestor) */}
            <div className="dark p-6 rounded-lg border border-border bg-background space-y-3">
              <span className="font-mono text-mono-label text-muted-foreground">
                Dark
              </span>
              <p className="text-accent-ink font-medium">
                accent-ink on dark
              </p>
              <div className="bg-primary p-3 rounded-md">
                <p className="text-primary-foreground font-medium">
                  primary-foreground on primary
                </p>
              </div>
            </div>
          </div>
        </Section>

        {/* ── Button ──────────────────────────────────────────────── */}
        <Section title="Button">
          {/* Variant × Size */}
          <Row label="primary × sm / default / lg">
            <Button variant="primary" size="sm">
              Small
            </Button>
            <Button variant="primary">Default</Button>
            <Button variant="primary" size="lg">
              Large
            </Button>
          </Row>

          <Row label="hero (on accent canvas)">
            <div className="bg-primary p-6 rounded-lg flex items-center gap-4 flex-wrap">
              <Button variant="hero" size="sm">
                Small
              </Button>
              <Button variant="hero">Default</Button>
              <Button variant="hero" size="lg">
                Large
              </Button>
            </div>
          </Row>

          <Row label="outline">
            <Button variant="outline" size="sm">
              Small
            </Button>
            <Button variant="outline">Default</Button>
            <Button variant="outline" size="lg">
              Large
            </Button>
          </Row>

          <Row label="nav-cta">
            <Button variant="nav-cta">Get Started</Button>
          </Row>

          {/* States — primary */}
          <Row label="states (primary)">
            <Button variant="primary">Default</Button>
            <Button variant="primary" className="opacity-95">
              Hover
            </Button>
            <Button variant="primary" className="translate-y-[1px]">
              Active
            </Button>
            <Button
              variant="primary"
              className="ring-[3px] ring-accent-outline/35 outline outline-[0.5px] outline-primary outline-offset-2"
            >
              Focus
            </Button>
            <Button variant="primary" disabled>
              Disabled
            </Button>
          </Row>

          {/* States — hero on accent canvas */}
          <Row label="states (hero on accent)">
            <div className="bg-primary p-6 rounded-lg flex items-center gap-4 flex-wrap">
              <Button variant="hero">Default</Button>
              <Button
                variant="hero"
                className="bg-transparent text-hero-text border-hero-text"
              >
                Hover
              </Button>
              <Button variant="hero" className="translate-y-[1px]">
                Active
              </Button>
              <Button
                variant="hero"
                className="ring-[3px] ring-accent-outline/35 outline outline-[0.5px] outline-primary outline-offset-2"
              >
                Focus
              </Button>
              <Button variant="hero" disabled>
                Disabled
              </Button>
            </div>
          </Row>

          {/* States — outline */}
          <Row label="states (outline)">
            <Button variant="outline">Default</Button>
            <Button variant="outline" className="opacity-95">
              Hover
            </Button>
            <Button variant="outline" className="translate-y-[1px]">
              Active
            </Button>
            <Button
              variant="outline"
              className="ring-[3px] ring-accent-outline/35 outline outline-[0.5px] outline-primary outline-offset-2"
            >
              Focus
            </Button>
            <Button variant="outline" disabled>
              Disabled
            </Button>
          </Row>
        </Section>

        {/* ── AnnouncementPill ────────────────────────────────────── */}
        <Section title="AnnouncementPill">
          <Row label="default">
            <AnnouncementPill
              items={["v2.4.0 released", "Approval workflows"]}
              href="#"
              linkLabel="Read more"
            />
          </Row>
          <Row label="accent (on canvas)">
            <div className="bg-primary p-6 rounded-lg inline-flex">
              <AnnouncementPill
                variant="accent"
                items={["New", "Secret rotation is live"]}
                href="#"
                linkLabel="Learn more"
              />
            </div>
          </Row>
        </Section>

        {/* ── Card ────────────────────────────────────────────────── */}
        <Section title="Card">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Card variant="hairline">
              <h4 className="text-h3 font-medium">Hairline</h4>
              <p className="text-sm text-muted-foreground mt-2">
                Surface-secondary bg, 1px border-default, 8px radius, 24px
                padding.
              </p>
            </Card>
            <Card variant="tint">
              <h4 className="text-h3 font-medium">Tint</h4>
              <p className="text-sm text-muted-foreground mt-2">
                Accent-tint bg at 8% opacity, accent-outline border at 35%.
              </p>
            </Card>
            <Card variant="blueprint">
              <h4 className="text-h3 font-medium">Blueprint</h4>
              <p className="text-sm text-muted-foreground mt-2">
                Hairline + crop-mark corners via CropMarkFrame.
              </p>
            </Card>
            <Card variant="blueprint" dashed>
              <h4 className="text-h3 font-medium">Blueprint + dashed</h4>
              <p className="text-sm text-muted-foreground mt-2">
                Children wrapped in a dashed-border sub-region.
              </p>
            </Card>
          </div>
          <Row label="interactive (hover border)">
            <Card
              variant="hairline"
              onClick={() => alert("Clicked!")}
              className="w-full sm:w-80"
            >
              <h4 className="text-h3 font-medium">Interactive Card</h4>
              <p className="text-sm text-muted-foreground mt-2">
                Hover to see border-input. Click to confirm interactivity.
              </p>
            </Card>
          </Row>
        </Section>

        {/* ── CropMarkFrame ───────────────────────────────────────── */}
        <Section title="CropMarkFrame">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
            <div className="space-y-2">
              <span className="font-mono text-xs text-muted-foreground">
                default (border-input)
              </span>
              <CropMarkFrame className="bg-card border border-border rounded-lg p-6">
                <p className="text-sm">
                  Content wrapped in a CropMarkFrame with default corner ticks.
                </p>
              </CropMarkFrame>
            </div>
            <div className="space-y-2">
              <span className="font-mono text-xs text-muted-foreground">
                custom color
              </span>
              <CropMarkFrame
                color="hsl(var(--primary))"
                className="bg-card border border-border rounded-lg p-6"
              >
                <p className="text-sm">
                  Corner ticks overridden to the accent primary color.
                </p>
              </CropMarkFrame>
            </div>
          </div>
        </Section>

        {/* ── SectionHeading ──────────────────────────────────────── */}
        <Section title="SectionHeading">
          <div className="space-y-12">
            <div className="space-y-2">
              <span className="font-mono text-xs text-muted-foreground">
                center (default)
              </span>
              <SectionHeading
                eyebrow="Platform"
                title="Region: Earth"
                description="Deploy secrets to every environment. One source of truth, zero drift."
              />
            </div>
            <div className="space-y-2">
              <span className="font-mono text-xs text-muted-foreground">
                left
              </span>
              <SectionHeading
                align="left"
                eyebrow="CLI"
                title="Ship from your terminal"
                description="envsync pull, envsync push. That's it."
              />
            </div>
          </div>
        </Section>

        {/* ── StatCallout ─────────────────────────────────────────── */}
        <Section title="StatCallout">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <StatCallout
              eyebrow="Uptime"
              numeral="99.99%"
              body="Over the last 12 months"
            />
            <StatCallout
              eyebrow="Integrations"
              numeral="28+"
              body="GitHub, Vercel, AWS, and more"
            />
            <StatCallout
              eyebrow="Secrets managed"
              numeral="1.2M"
              body="Across all teams globally"
            />
          </div>
        </Section>

        {/* ── Terminal ────────────────────────────────────────────── */}
        <Section title="Terminal">
          <Terminal title="envsync-cli" lines={terminalLines} />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
            <Terminal
              title="cmd-only"
              lines={[{ type: "cmd", text: "envsync auth whoami" }]}
            />
            <Terminal
              title="mixed"
              lines={[
                { type: "info", text: "Checking credentials..." },
                { type: "success", text: "Authenticated as dev@envsync.cloud" },
                { type: "warn", text: "Token expires in 2 hours" },
              ]}
            />
          </div>
        </Section>

        {/* ── TabPills ────────────────────────────────────────────── */}
        <Section title="TabPills">
          <TabPills tabs={demoTabs} active={activeTab} onChange={setActiveTab} />
          <div className="mt-4 p-6 bg-card border border-border rounded-lg">
            <p className="text-sm text-muted-foreground">
              Active tab:{" "}
              <span className="font-mono text-foreground">{activeTab}</span>
            </p>
          </div>
        </Section>

        {/* ── LogoCell ────────────────────────────────────────────── */}
        <Section title="LogoCell">
          <p className="text-sm text-muted-foreground">
            Grid cells with shared hairline technique (-ml-px -mt-px).
          </p>
          <div className="grid grid-cols-3 sm:grid-cols-6 ml-px mt-px">
            <LogoCell>
              <Globe className="w-8 h-8" />
            </LogoCell>
            <LogoCell>
              <Shield className="w-8 h-8" />
            </LogoCell>
            <LogoCell>
              <GitBranch className="w-8 h-8" />
            </LogoCell>
            <LogoCell>
              <Lock className="w-8 h-8" />
            </LogoCell>
            <LogoCell>
              <Server className="w-8 h-8" />
            </LogoCell>
            <LogoCell>
              <Zap className="w-8 h-8" />
            </LogoCell>
          </div>
        </Section>

        {/* ── SplitPanel ──────────────────────────────────────────── */}
        <Section title="SplitPanel">
          <SplitPanel
            leftSlot={
              <>
                <h4 className="text-h3 font-medium">
                  Approval Workflows
                </h4>
                <p className="text-sm text-muted-foreground mt-2">
                  Require review before production changes. Every secret update
                  flows through a change request with full audit trail.
                </p>
              </>
            }
            rightSlot={
              <>
                <Shield className="w-8 h-8" />
                <h4 className="text-h3 font-medium">Zero-trust by default</h4>
                <p className="text-sm opacity-90">
                  End-to-end encryption. AES-256 at rest, TLS in transit. Your
                  keys never touch our servers unencrypted.
                </p>
              </>
            }
          />
        </Section>

        {/* ── BeamCard ────────────────────────────────────────────── */}
        <Section title="BeamCard">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <BeamCard>
              <h4 className="text-h3 font-medium">Hover me</h4>
              <p className="text-sm text-muted-foreground mt-2">
                The animated conic border appears on hover via the beam-border
                utility.
              </p>
            </BeamCard>
            <BeamCard active>
              <h4 className="text-h3 font-medium">Always active</h4>
              <p className="text-sm text-muted-foreground mt-2">
                The beam-border is always visible when the active prop is true.
              </p>
            </BeamCard>
          </div>
        </Section>

        {/* ── ThemeToggle ─────────────────────────────────────────── */}
        <Section title="ThemeToggle">
          <Row>
            <ThemeToggle />
            <span className="text-sm text-muted-foreground">
              Click to toggle light / dark. Uses next-themes with mounted guard.
            </span>
          </Row>
        </Section>
      </div>
    </div>
  )
}
