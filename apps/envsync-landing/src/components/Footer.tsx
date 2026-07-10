import { Github } from "lucide-react";
import { Link } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { runtimeConfig } from "@/utils/runtime-config";

const Footer = () => {
  return (
    <footer className="container relative mx-auto border-x border-t border-border bg-background p-0">
      <div className="container relative z-10 mx-auto p-0">
        <div className="relative overflow-hidden border border-border bg-[hsl(var(--surface-1))]">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 opacity-45"
            style={{
              backgroundImage:
                "linear-gradient(hsl(var(--border) / 0.7) 1px, transparent 1px), linear-gradient(90deg, hsl(var(--border) / 0.7) 1px, transparent 1px)",
              backgroundSize: "36px 36px",
            }}
          />
          <div className="relative z-10 grid grid-cols-1 gap-0 md:grid-cols-4">
            <div className="border border-border bg-[hsl(var(--surface-1))] p-6 md:col-span-1">
              <div className="mb-4 flex items-center space-x-2">
                <img src="/EnvSync.svg" alt="EnvSync Logo" className="h-8 w-8" />
                <span className="text-xl font-bold text-foreground">EnvSync</span>
                <Badge className="rounded-none border border-sky-500/60 bg-sky-500/15 px-2 py-1 text-xs font-bold text-sky-300 hover:bg-sky-500/20">
                  BETA
                </Badge>
              </div>
              <p className="mb-6 text-muted-foreground">
                Developer-first environment control for teams shipping across staging, CI, and production.
              </p>
              <div className="flex space-x-4">
                <a href="https://github.com/EnvSync-Cloud/envsync" className="text-muted-foreground transition-colors hover:text-primary">
                  <Github className="h-5 w-5" />
                </a>
              </div>
            </div>

            <div className="-ml-px border border-border bg-[hsl(var(--surface-1))] p-6">
              <h3 className="mb-4 font-semibold text-foreground">Developer</h3>
              <ul className="space-y-2">
                <li><a href={runtimeConfig.apiDocsUrl} className="text-muted-foreground transition-colors hover:text-foreground">API Reference</a></li>
                <li><a href="https://github.com/EnvSync-Cloud/envsync" className="text-muted-foreground transition-colors hover:text-foreground">GitHub</a></li>
              </ul>
            </div>

            <div className="-ml-px -mt-px border border-border bg-[hsl(var(--surface-1))] p-6 md:mt-0">
              <h3 className="mb-4 font-semibold text-foreground">Workflow</h3>
              <ul className="space-y-2">
                <li><Link to="/integrations" className="text-muted-foreground transition-colors hover:text-foreground">Integrations</Link></li>
                <li><Link to="/onboarding" className="text-muted-foreground transition-colors hover:text-foreground">Get Started</Link></li>
              </ul>
            </div>

            <div className="-ml-px -mt-px border border-border bg-[hsl(var(--surface-1))] p-6 md:mt-0">
              <h3 className="mb-4 font-semibold text-foreground">Company</h3>
              <ul className="space-y-2">
                <li><a href="/about" className="text-muted-foreground transition-colors hover:text-foreground">About</a></li>
                <li><a href="mailto:team@envsync.cloud" className="text-muted-foreground transition-colors hover:text-foreground">Contact</a></li>
              </ul>
            </div>
          </div>
        </div>

        <div className="-mt-px border border-border bg-[hsl(var(--surface-2))] px-6 py-6">
          <div className="flex flex-col items-start justify-between gap-2 md:flex-row md:items-center">
            <p className="text-sm text-muted-foreground">&copy; {new Date().getFullYear()} EnvSync. All rights reserved.</p>
            <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Built for delivery-safe config changes</p>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
