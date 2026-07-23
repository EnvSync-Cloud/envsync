import { Cloud, Container, GitBranch, Globe, Server, Workflow } from "lucide-react"
import { SectionHeading } from "@/components/primitives/SectionHeading"

const integrations = [
  { icon: Workflow, name: "GitHub Actions", description: "Inject secrets into CI/CD pipelines" },
  { icon: Container, name: "Docker", description: "Sync env vars to containers at runtime" },
  { icon: Globe, name: "Vercel", description: "Deploy with env vars automatically" },
  { icon: Cloud, name: "Cloudflare", description: "Workers and Pages integration" },
  { icon: Server, name: "AWS", description: "Lambda and ECS environment sync" },
  { icon: GitBranch, name: "GitLab CI", description: "Pipeline secret injection" },
]

const NewIntegrations = () => {
  return (
    <section className="border-t border-border bg-background">
      <div className="mx-auto max-w-[1280px] px-4 py-16 sm:px-8 md:py-24">
        <SectionHeading
          align="center"
          eyebrow="INTEGRATIONS"
          title="Works with your stack"
          description="Plug EnvSync into the tools you already use. No vendor lock-in."
        />

        <div className="mt-16 grid gap-px overflow-hidden rounded-lg border border-border bg-border sm:grid-cols-2 lg:grid-cols-3">
          {integrations.map((integration) => (
            <div
              key={integration.name}
              className="bg-background p-6 transition-colors duration-200 hover:bg-card md:p-8"
            >
              <integration.icon
                className="h-6 w-6 text-foreground"
                strokeWidth={1.5}
              />
              <h3 className="mt-4 text-h3 font-medium text-foreground">
                {integration.name}
              </h3>
              <p className="mt-1 text-sm text-muted-foreground">
                {integration.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

export default NewIntegrations
