
import { Github } from "lucide-react";
import { Badge } from "@/components/ui/badge";

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
                <img
                  src="/EnvSync.svg"
                  alt="EnvSync Logo"
                  className="h-8 w-8"
                />
                <span className="text-xl font-bold text-foreground">EnvSync</span>
                <Badge className="rounded-none border border-orange-500/60 bg-orange-500/15 px-2 py-1 text-xs font-bold text-orange-300 hover:bg-orange-500/20">
                  ALPHA
                </Badge>
              </div>
              <p className="mb-6 text-muted-foreground">
                Secure environment management for modern development teams.
              </p>
              <div className="flex space-x-4">
                <a href="https://github.com/EnvSync-Cloud" className="text-muted-foreground transition-colors hover:text-primary">
                  <Github className="h-5 w-5" />
                </a>
              </div>
            </div>

            <div className="-ml-px border border-border bg-[hsl(var(--surface-1))] p-6">
              <h3 className="mb-4 font-semibold text-foreground">Product</h3>
              <ul className="space-y-2">
                <li><a href="/integrations" className="text-muted-foreground transition-colors hover:text-foreground">Integrations</a></li>
              </ul>
            </div>

            <div className="-ml-px -mt-px border border-border bg-[hsl(var(--surface-1))] p-6 md:mt-0">
              <h3 className="mb-4 font-semibold text-foreground">Resources</h3>
              <ul className="space-y-2">
                <li><a href="https://blog.envsync.cloud" className="text-muted-foreground transition-colors hover:text-foreground">Blog</a></li>
                <li><a href="https://api.envsync.cloud/docs" className="text-muted-foreground transition-colors hover:text-foreground">API Reference</a></li>
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
            <p className="text-sm text-muted-foreground">
              &copy; {new Date().getFullYear()} EnvSync. All rights reserved.
            </p>
            <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Built for secure shipping</p>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
