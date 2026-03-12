import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowRight, MessageCircle, Shield } from "lucide-react";

type Integration = {
  name: string;
  description: string;
  icon: string;
  status: "coming-soon";
};

const notificationIntegrations: Integration[] = [
  {
    name: "Slack",
    description: "Route environment and security alerts directly into operational channels.",
    icon: "/images/Slack.svg",
    status: "coming-soon",
  },
  {
    name: "Discord",
    description: "Stream change notifications to Discord for distributed engineering teams.",
    icon: "https://raw.githubusercontent.com/tandpfun/skill-icons/refs/heads/main/icons/Discord.svg",
    status: "coming-soon",
  },
];

const platformIntegrations: Integration[] = [
  {
    name: "Vercel",
    description: "Sync environment updates into deployments without manual dashboard steps.",
    icon: "https://raw.githubusercontent.com/tandpfun/skill-icons/refs/heads/main/icons/Vercel-Dark.svg",
    status: "coming-soon",
  },
  {
    name: "Cloudflare",
    description: "Push variables and secrets to edge workloads with controlled rollout behavior.",
    icon: "https://raw.githubusercontent.com/tandpfun/skill-icons/refs/heads/main/icons/Cloudflare-Dark.svg",
    status: "coming-soon",
  },
  {
    name: "AWS",
    description: "Bridge cloud workloads with centralized environment and secret policy layers.",
    icon: "https://raw.githubusercontent.com/tandpfun/skill-icons/refs/heads/main/icons/AWS-Dark.svg",
    status: "coming-soon",
  },
  {
    name: "GitHub Actions",
    description: "Inject managed environment values into CI workflows with less drift risk.",
    icon: "https://raw.githubusercontent.com/tandpfun/skill-icons/refs/heads/main/icons/GithubActions-Dark.svg",
    status: "coming-soon",
  },
];

const IntegrationGrid = ({ integrations }: { integrations: Integration[] }) => (
  <div className="grid grid-cols-1 gap-0 md:grid-cols-2">
    {integrations.map((integration) => (
      <div
        key={integration.name}
        className="-ml-px -mt-px border border-border bg-[hsl(var(--surface-1))] p-6 md:p-7"
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center border border-border bg-[hsl(var(--surface-2))]">
              <img src={integration.icon} alt={`${integration.name} icon`} className="h-6 w-6" />
            </div>
            <h3 className="text-xl font-semibold text-foreground">{integration.name}</h3>
          </div>
          <Badge className="rounded-none border border-border bg-[hsl(var(--surface-2))] text-xs text-muted-foreground hover:bg-[hsl(var(--surface-2))]">
            Coming soon
          </Badge>
        </div>
        <p className="text-sm leading-relaxed text-muted-foreground md:text-base">{integration.description}</p>
      </div>
    ))}
  </div>
);

const Integrations = () => {
  return (
    <div className="min-h-screen bg-background">
      <Header />

      <main className="pt-16">
        <section className="container mx-auto border-x border-border px-0 ">
          <div className="relative w-full overflow-hidden border border-border bg-[hsl(var(--surface-1))] p-6 text-left md:p-8 md:py-32">
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
            <p className="mb-4 text-xs font-semibold uppercase tracking-[0.16em] text-primary">Integrations</p>
            <h1 className="mb-6 text-5xl font-bold text-foreground md:text-6xl">
              Connect EnvSync with the tools your team ships on.
            </h1>
            <p className="text-lg text-muted-foreground md:text-xl">
              Build a consistent secret delivery workflow across notifications, CI, cloud platforms,
              and runtime environments.
            </p>
            </div>
          </div>
        </section>

        <section className="container mx-auto border-x border-t border-border p-0">
          <div className="w-full">
            <div className="relative overflow-hidden border border-border bg-[hsl(var(--surface-1))] p-6 text-left md:p-8">
              <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-0 opacity-45"
                style={{
                  backgroundImage:
                    "linear-gradient(hsl(var(--border) / 0.7) 1px, transparent 1px), linear-gradient(90deg, hsl(var(--border) / 0.7) 1px, transparent 1px)",
                  backgroundSize: "36px 36px",
                }}
              />
              <div className="relative z-10 flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center border border-border bg-[hsl(var(--surface-2))]">
                  <MessageCircle className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-foreground">Notifications</h2>
                  <p className="text-sm text-muted-foreground md:text-base">
                    Keep engineering and security teams informed in real-time.
                  </p>
                </div>
              </div>
            </div>
            <IntegrationGrid integrations={notificationIntegrations} />
          </div>
        </section>

        <section className="container mx-auto border-x border-t border-border p-0">
          <div className="w-full">
            <div className="relative overflow-hidden border border-border bg-[hsl(var(--surface-1))] p-6 text-left md:p-8">
              <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-0 opacity-45"
                style={{
                  backgroundImage:
                    "linear-gradient(hsl(var(--border) / 0.7) 1px, transparent 1px), linear-gradient(90deg, hsl(var(--border) / 0.7) 1px, transparent 1px)",
                  backgroundSize: "36px 36px",
                }}
              />
              <div className="relative z-10 flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center border border-border bg-[hsl(var(--surface-2))]">
                  <Shield className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-foreground">Deployment Platforms</h2>
                  <p className="text-sm text-muted-foreground md:text-base">
                    Push controlled environment updates wherever your workloads run.
                  </p>
                </div>
              </div>
            </div>
            <IntegrationGrid integrations={platformIntegrations} />
          </div>
        </section>

        <section className="container mx-auto border-x border-t border-border p-0">
          <div className="relative w-full overflow-hidden border border-border bg-[hsl(var(--surface-1))] p-8 text-left md:p-10">
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
              <h3 className="mb-4 text-3xl font-bold text-foreground">Need a custom integration?</h3>
              <p className="mb-8 max-w-2xl text-lg text-muted-foreground">
                Tell us what your stack needs. We prioritize integrations that improve secure delivery velocity.
              </p>
              <Button size="lg" className="px-8">
                Request Integration
                <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
};

export default Integrations;
