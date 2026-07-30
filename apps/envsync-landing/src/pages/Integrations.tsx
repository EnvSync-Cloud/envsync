import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { Button } from "@/components/primitives/Button";
import { cn } from "@/lib/utils";
import { ArrowRight, Cloud, Code, Database, MessageCircle } from "lucide-react";

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

const categories = [
  {
    key: "cicd",
    icon: Code,
    title: "CI/CD",
    description: "Inject secrets into your pipelines with scoped access and audit trails.",
    integrations: cicdIntegrations,
  },
  {
    key: "platform",
    icon: Cloud,
    title: "PaaS & Deployment",
    description: "Push controlled environment updates wherever your workloads run.",
    integrations: platformIntegrations,
  },
  {
    key: "cloud",
    icon: Database,
    title: "Cloud Providers",
    description: "Sync secrets to native cloud secret stores and serverless platforms.",
    integrations: cloudIntegrations,
  },
  {
    key: "notification",
    icon: MessageCircle,
    title: "Notifications",
    description: "Keep engineering and security teams informed in real-time.",
    integrations: notificationIntegrations,
  },
];

const IntegrationGrid = ({ integrations }: { integrations: Integration[] }) => (
  <div className="mt-8 grid gap-px overflow-hidden rounded-lg border border-border bg-border md:grid-cols-2">
    {integrations.map((integration) => (
      <div
        key={integration.name}
        className="bg-background p-6 transition-colors duration-200 hover:bg-card"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-md border border-border bg-card">
              <img src={integration.icon} alt={`${integration.name} icon`} className="h-6 w-6" />
            </div>
            <h3 className="text-h3 font-medium text-foreground">{integration.name}</h3>
          </div>
          <span
            className={cn(
              "rounded-full border px-2 py-0.5 font-mono text-mono-label",
              integration.status === "live" && "border-primary/35 text-accent-ink",
              integration.status === "coming-soon" && "border-status-warning/35 text-status-warning",
            )}
          >
            {integration.status}
          </span>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">{integration.description}</p>
      </div>
    ))}
  </div>
);

const Integrations = () => {
  return (
    <div className="min-h-screen bg-background">
      <Header />

      <main className="pt-16">
        <section className="border-b border-border bg-background">
          <div className="mx-auto max-w-[1280px] px-4 py-16 sm:px-8 md:py-24 text-left">
            <p className="font-mono text-mono-label uppercase text-accent-ink">Integrations</p>
            <h1 className="mt-4 max-w-3xl text-h1 font-medium text-foreground text-balance">
              Connect EnvSync with the tools your team ships on.
            </h1>
            <p className="mt-6 max-w-2xl text-lead text-muted-foreground">
              28+ integrations across CI/CD, cloud platforms, PaaS providers, and notification channels.
            </p>
          </div>
        </section>

        {categories.map((cat) => (
          <section key={cat.key} className="border-b border-border">
            <div className="mx-auto max-w-[1280px] px-4 py-16 sm:px-8">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-md border border-border bg-card">
                  <cat.icon className="h-5 w-5 text-foreground" strokeWidth={1.5} />
                </div>
                <div>
                  <h2 className="text-h2 font-medium text-foreground">{cat.title}</h2>
                  <p className="text-sm text-muted-foreground">{cat.description}</p>
                </div>
              </div>
              <IntegrationGrid integrations={cat.integrations} />
            </div>
          </section>
        ))}

        <section className="border-b border-border">
          <div className="mx-auto max-w-[1280px] px-4 py-16 sm:px-8">
            <div className="rounded-lg border border-border bg-card p-8 md:p-10">
              <h2 className="text-h2 font-medium text-foreground">Need a custom integration?</h2>
              <p className="mt-4 max-w-2xl text-muted-foreground">
                Tell us what your stack needs. We prioritize integrations that improve secure delivery velocity.
              </p>
              <a
                href="https://github.com/EnvSync-Cloud/envsync/issues/new?title=Feature%20Request:%20&labels=enhancement"
                target="_blank"
                rel="noopener noreferrer"
                className="mt-8 inline-block"
              >
                <Button variant="primary" size="lg">
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
