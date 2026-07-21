import { Button } from "@/components/ui/button";
import { ArrowRight, Github } from "lucide-react";
import { Link } from "react-router-dom";
import { runtimeConfig } from "@/utils/runtime-config";

const CTA = () => {
  return (
    <section className="container mx-auto px-4 md:px-8 py-16 md:py-24">
      <div className="relative container mx-auto z-10 px-0">
        <div className="relative w-full overflow-hidden border border-border bg-[hsl(var(--surface-1))] p-7 text-left md:p-10">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 opacity-45"
            style={{
              backgroundImage:
                "linear-gradient(hsl(var(--border) / 0.7) 1px, transparent 1px), linear-gradient(90deg, hsl(var(--border) / 0.7) 1px, transparent 1px)",
              backgroundSize: "36px 36px",
            }}
          />
          <div className="relative z-10 grid gap-8 lg:grid-cols-[1fr_auto] lg:items-end">
            <div>
              <h2 className="text-4xl font-bold leading-tight tracking-tight text-foreground md:text-5xl">
                Start with the CLI. Keep the workflow when you reach production.
              </h2>
              <p className="mt-4 max-w-2xl text-lg text-muted-foreground">
                CLI-first setup, managed or self-hosted, with approvals and audit trail built in.
              </p>
            </div>

            <div className="flex flex-col items-start gap-4">
              <Link to="/onboarding" className="w-full md:w-auto">
                <Button size="lg" className="w-full px-8 text-base">
                  Start for Free
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
              <a href={runtimeConfig.apiDocsUrl} className="w-full md:w-auto">
                <Button size="lg" variant="outline" className="w-full px-8 text-base">
                  View API Reference
                </Button>
              </a>
              <a href="https://github.com/EnvSync-Cloud/envsync" className="w-full md:w-auto">
                <Button size="lg" variant="outline" className="w-full px-8 text-base">
                  <Github className="h-4 w-4" />
                  View GitHub
                </Button>
              </a>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default CTA;
