import { Button } from "@/components/ui/button";
import { ArrowRight, Github } from "lucide-react";
import { Link } from "react-router-dom";

const NewHero = () => {
  return (
    <section className="relative overflow-hidden border-b border-border bg-background">
      <div className="container mx-auto px-4 py-16 md:px-8 md:py-24 lg:py-32">
        <div className="mx-auto max-w-4xl text-center">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-4 py-1.5 text-sm font-medium text-primary">
            <span className="h-2 w-2 rounded-full bg-primary animate-pulse" />
            Now in public beta
          </div>

          <h1 className="text-4xl font-bold tracking-tight text-foreground md:text-6xl lg:text-7xl">
            Ship environment variables{" "}
            <span className="text-primary">without the drift.</span>
          </h1>

          <p className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground md:text-xl">
            CLI-first secrets and config delivery for dev, staging, CI, and production. 
            Pull, push, approve — no more .env file chaos.
          </p>

          <div className="mt-10 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
            <Link to="/onboarding">
              <Button size="lg" className="gap-2 px-8 text-base">
                Start for free
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
            <a href="https://github.com/EnvSync-Cloud/envsync">
              <Button size="lg" variant="outline" className="gap-2 px-8 text-base">
                <Github className="h-4 w-4" />
                View on GitHub
              </Button>
            </a>
          </div>

          <div className="mt-10 overflow-hidden rounded-xl border border-border bg-[#0a0f15] text-left">
            <div className="flex items-center gap-2 border-b border-border px-4 py-3">
              <div className="h-3 w-3 rounded-full bg-red-500/60" />
              <div className="h-3 w-3 rounded-full bg-yellow-500/60" />
              <div className="h-3 w-3 rounded-full bg-green-500/60" />
              <span className="ml-2 text-xs text-muted-foreground">Terminal</span>
            </div>
            <div className="p-6 font-mono text-sm">
              <div className="text-muted-foreground">$ envsync pull --env staging</div>
              <div className="mt-2 text-primary">✓ Synced 12 values from staging</div>
              <div className="mt-4 text-muted-foreground">$ envsync push --env production --strict</div>
              <div className="mt-2 text-yellow-400">⏳ Approval required before prod sync</div>
              <div className="mt-4 text-muted-foreground">$ envsync request approve --id cr_abc123</div>
              <div className="mt-2 text-primary">✓ Approved and deployed to production</div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default NewHero;
