
import { Github } from "lucide-react";
import { Badge } from "@/components/ui/badge";

const Footer = () => {
  return (
    <footer className="container relative mx-auto border-x border-t border-border bg-background">
      <div className="container relative z-10 mx-auto px-0 py-12">
        <div className="grid grid-cols-1 gap-8 md:grid-cols-4">
          <div className="md:col-span-1">
            <div className="flex items-center space-x-2 mb-4">
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

          <div>
            <h3 className="mb-4 font-semibold text-foreground">Product</h3>
            <ul className="space-y-2">
              <li><a href="/integrations" className="text-muted-foreground transition-colors hover:text-foreground">Integrations</a></li>
            </ul>
          </div>

          <div>
            <h3 className="mb-4 font-semibold text-foreground">Resources</h3>
            <ul className="space-y-2">
              <li><a href="https://blog.envsync.cloud" className="text-muted-foreground transition-colors hover:text-foreground">Blog</a></li>
              <li><a href="https://api.envsync.cloud/docs" className="text-muted-foreground transition-colors hover:text-foreground">API Reference</a></li>
            </ul>
          </div>

          <div>
            <h3 className="mb-4 font-semibold text-foreground">Company</h3>
            <ul className="space-y-2">
              <li><a href="/about" className="text-muted-foreground transition-colors hover:text-foreground">About</a></li>
              <li><a href="mailto:team@envsync.cloud" className="text-muted-foreground transition-colors hover:text-foreground">Contact</a></li>
            </ul>
          </div>
        </div>

        <div className="mt-8 border-t border-border pt-8">
          <div className="flex flex-col md:flex-row justify-between items-center">
            <p className="text-sm text-muted-foreground">
              &copy; {new Date().getFullYear()} EnvSync. All rights reserved.
            </p>
            <div className="flex space-x-6 mt-4 md:mt-0" />
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
