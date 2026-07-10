import { Cloud, Container, GitBranch, Globe, Server, Workflow } from "lucide-react";

const integrations = [
  { icon: Workflow, name: "GitHub Actions", description: "Inject secrets into CI/CD pipelines" },
  { icon: Container, name: "Docker", description: "Sync env vars to containers at runtime" },
  { icon: Globe, name: "Vercel", description: "Deploy with env vars automatically" },
  { icon: Cloud, name: "Cloudflare", description: "Workers and Pages integration" },
  { icon: Server, name: "AWS", description: "Lambda and ECS environment sync" },
  { icon: GitBranch, name: "GitLab CI", description: "Pipeline secret injection" },
];

const NewIntegrations = () => {
  return (
    <section className="border-b border-border bg-[#0a0f15]">
      <div className="container mx-auto px-4 py-24 md:px-8 md:py-32">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-bold tracking-tight text-foreground md:text-4xl">
            Works with your stack
          </h2>
          <p className="mt-4 text-lg text-muted-foreground">
            Plug EnvSync into the tools you already use. No vendor lock-in.
          </p>
        </div>
        <div className="mx-auto mt-16 grid max-w-5xl gap-6 md:grid-cols-2 lg:grid-cols-3">
          {integrations.map((integration) => (
            <div key={integration.name} className="flex items-start gap-4 rounded-xl border border-border bg-card p-6 transition-colors hover:bg-accent/50">
              <integration.icon className="h-8 w-8 shrink-0 text-primary" />
              <div>
                <h3 className="font-semibold text-foreground">{integration.name}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{integration.description}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default NewIntegrations;
