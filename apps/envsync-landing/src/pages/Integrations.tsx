import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ArrowRight, Cloud, Code, Database, MessageCircle, Shield } from "lucide-react";

type Integration = {
  name: string;
  description: string;
  icon: string;
  status: "coming-soon" | "live";
};

const notificationIntegrations: Integration[] = [
  {
    name: "Slack",
    description: "Route environment and security alerts directly into operational channels.",
    icon: "/images/Slack.svg",
    status: "live",
  },
  {
    name: "Discord",
    description: "Stream change notifications to Discord for distributed engineering teams.",
    icon: "/images/integrations/discord.svg",
    status: "live",
  },
];

const cicdIntegrations: Integration[] = [
  {
    name: "GitHub Actions",
    description: "Inject managed environment values into CI workflows with less drift risk.",
    icon: "/images/integrations/github-actions.svg",
    status: "live",
  },
  {
    name: "GitLab CI",
    description: "Sync secrets and variables into GitLab pipelines with scoped access.",
    icon: "/images/integrations/gitlab.svg",
    status: "live",
  },
  {
    name: "CircleCI",
    description: "Inject environment variables into CircleCI jobs with context-aware scoping.",
    icon: "/images/integrations/circleci.svg",
    status: "live",
  },
  {
    name: "Jenkins",
    description: "Push secrets to Jenkins credentials store for pipeline consumption.",
    icon: "/images/integrations/jenkins.svg",
    status: "live",
  },
  {
    name: "Azure DevOps",
    description: "Sync variables into Azure DevOps pipelines and variable groups.",
    icon: "/images/integrations/azuredevops.svg",
    status: "live",
  },
  {
    name: "Bitbucket Pipelines",
    description: "Inject environment variables into Bitbucket CI/CD pipelines.",
    icon: "/images/integrations/bitbucket.svg",
    status: "live",
  },
  {
    name: "Travis CI",
    description: "Push environment variables to Travis CI builds.",
    icon: "/images/integrations/traviisci.svg",
    status: "live",
  },
];

const platformIntegrations: Integration[] = [
  {
    name: "Vercel",
    description: "Sync environment updates into deployments without manual dashboard steps.",
    icon: "/images/integrations/vercel.svg",
    status: "live",
  },
  {
    name: "Netlify",
    description: "Push environment variables to Netlify sites and functions.",
    icon: "/images/integrations/netlify.svg",
    status: "live",
  },
  {
    name: "Railway",
    description: "Sync secrets and variables to Railway projects and services.",
    icon: "/images/integrations/railway.svg",
    status: "live",
  },
  {
    name: "Fly.io",
    description: "Push secrets to Fly.io apps with deployment-aware scoping.",
    icon: "/images/integrations/flyio.svg",
    status: "live",
  },
  {
    name: "Render",
    description: "Sync environment variables to Render services and databases.",
    icon: "/images/integrations/render.svg",
    status: "live",
  },
  {
    name: "Supabase",
    description: "Push secrets to Supabase projects and edge functions.",
    icon: "/images/integrations/supabase.svg",
    status: "live",
  },
  {
    name: "DigitalOcean",
    description: "Sync environment variables to DigitalOcean App Platform and Functions.",
    icon: "/images/integrations/digitalocean.svg",
    status: "live",
  },
];

const cloudIntegrations: Integration[] = [
  {
    name: "AWS",
    description: "Bridge cloud workloads with centralized environment and secret policy layers.",
    icon: "/images/integrations/aws.svg",
    status: "live",
  },
  {
    name: "Azure Key Vault",
    description: "Sync secrets to Azure Key Vault for enterprise secret management.",
    icon: "/images/integrations/azure.svg",
    status: "live",
  },
  {
    name: "Google Cloud",
    description: "Push secrets to Google Cloud Secret Manager and Cloud Functions.",
    icon: "/images/integrations/gcp.svg",
    status: "live",
  },
  {
    name: "Cloudflare",
    description: "Push variables and secrets to edge workloads with controlled rollout behavior.",
    icon: "/images/integrations/cloudflare.svg",
    status: "live",
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
          <Badge
            className={cn(
              "rounded-none border text-xs font-medium",
              integration.status === "live" &&
                "border-primary/35 bg-primary/15 text-primary hover:bg-primary/20",
              integration.status === "coming-soon" &&
                "border-amber-500/30 bg-amber-500/10 text-amber-100/90 hover:bg-amber-500/15",
            )}
          >
            {integration.status}
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
              28+ integrations across CI/CD, cloud platforms, PaaS providers, and notification channels.
            </p>
            </div>
          </div>
        </section>

        <section className="container mx-auto border-x border-t border-border p-0">
          <div className="w-full">
            <div className="relative overflow-hidden border border-border bg-[hsl(var(--surface-1))] p-6 text-left md:p-8">
              <div className="relative z-10 flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center border border-border bg-[hsl(var(--surface-2))]">
                  <Code className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-foreground">CI/CD</h2>
                  <p className="text-sm text-muted-foreground md:text-base">
                    Inject secrets into your pipelines with scoped access and audit trails.
                  </p>
                </div>
              </div>
            </div>
            <IntegrationGrid integrations={cicdIntegrations} />
          </div>
        </section>

        <section className="container mx-auto border-x border-t border-border p-0">
          <div className="w-full">
            <div className="relative overflow-hidden border border-border bg-[hsl(var(--surface-1))] p-6 text-left md:p-8">
              <div className="relative z-10 flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center border border-border bg-[hsl(var(--surface-2))]">
                  <Cloud className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-foreground">PaaS & Deployment</h2>
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
          <div className="w-full">
            <div className="relative overflow-hidden border border-border bg-[hsl(var(--surface-1))] p-6 text-left md:p-8">
              <div className="relative z-10 flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center border border-border bg-[hsl(var(--surface-2))]">
                  <Database className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-foreground">Cloud Providers</h2>
                  <p className="text-sm text-muted-foreground md:text-base">
                    Sync secrets to native cloud secret stores and serverless platforms.
                  </p>
                </div>
              </div>
            </div>
            <IntegrationGrid integrations={cloudIntegrations} />
          </div>
        </section>

        <section className="container mx-auto border-x border-t border-border p-0">
          <div className="w-full">
            <div className="relative overflow-hidden border border-border bg-[hsl(var(--surface-1))] p-6 text-left md:p-8">
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
              <a
                href="https://github.com/EnvSync-Cloud/envsync/issues/new?title=Feature%20Request:%20&labels=enhancement"
                target="_blank"
                rel="noopener noreferrer"
              >
                <Button size="lg" className="px-8">
                  Request Integration
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </a>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
};

export default Integrations;
