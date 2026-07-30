import { Github } from "lucide-react";
import { Link } from "react-router-dom";
import { runtimeConfig } from "@/utils/runtime-config";

// Version synced from package.json — update manually on release.
export const VERSION = "v0.11.0";

const linkClasses =
  "rounded-sm text-sm text-muted-foreground transition-colors duration-200 " +
  "hover:text-foreground focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-accent-outline/35";

const linkGroups = [
  {
    heading: "Developer",
    links: [
      { label: "API Reference", href: runtimeConfig.apiDocsUrl, external: true },
      { label: "GitHub", href: "https://github.com/EnvSync-Cloud/envsync", external: true },
    ],
  },
  {
    heading: "Workflow",
    links: [
      { label: "Integrations", href: "/integrations", external: false },
      { label: "Get Started", href: "/onboarding", external: false },
    ],
  },
  {
    heading: "Company",
    links: [
      { label: "About", href: "/about", external: false },
      { label: "Roadmap", href: "https://envsync.notion.site", external: true },
      { label: "Contact", href: "mailto:team@envsync.cloud", external: true },
    ],
  },
] as const;

const Footer = () => {
  return (
    <footer className="border-t border-border bg-background">
      <div className="mx-auto max-w-[1480px] px-4 py-16 sm:px-8">
        <div className="grid gap-12 md:grid-cols-[2fr_1fr_1fr_1fr]">
          {/* Brand column */}
          <div>
            <Link to="/" className="flex items-center gap-2">
              <img src="/EnvSync.svg" alt="EnvSync Logo" className="h-7 w-7" />
              <span className="text-base font-medium text-foreground">EnvSync</span>
              <span className="rounded-full border border-border px-2 py-0.5 font-mono text-xs leading-4 text-muted-foreground">
                BETA
              </span>
            </Link>
            <p className="mt-4 max-w-xs text-sm text-muted-foreground">
              Developer-first environment control for teams shipping across staging, CI, and production.
            </p>
            <div className="mt-6">
              <a
                href="https://github.com/EnvSync-Cloud/envsync"
                className="rounded-sm text-muted-foreground transition-colors duration-200 hover:text-foreground focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-accent-outline/35"
                aria-label="GitHub"
              >
                <Github className="h-4 w-4" />
              </a>
            </div>
          </div>

          {/* Link groups */}
          {linkGroups.map((group) => (
            <div key={group.heading}>
              <span className="mb-4 block font-mono text-xs leading-4 tracking-normal text-tertiary">
                {group.heading}
              </span>
              <ul className="space-y-3">
                {group.links.map((link) => (
                  <li key={link.label}>
                    {link.external ? (
                      <a
                        href={link.href}
                        target={link.href.startsWith("mailto:") ? undefined : "_blank"}
                        rel={link.href.startsWith("mailto:") ? undefined : "noopener noreferrer"}
                        className={linkClasses}
                      >
                        {link.label}
                      </a>
                    ) : (
                      <Link
                        to={link.href}
                        className={linkClasses}
                      >
                        {link.label}
                      </Link>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>

      {/* Bottom bar */}
      <div className="border-t border-border">
        <div className="mx-auto flex max-w-[1480px] flex-col gap-2 px-4 py-6 sm:px-8 md:flex-row md:items-center md:justify-between">
          <p className="text-sm text-muted-foreground">
            &copy; {new Date().getFullYear()} EnvSync. All rights reserved.
          </p>
          <span className="font-mono text-xs leading-4 text-tertiary">{VERSION}</span>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
