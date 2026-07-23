import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Menu, Moon, Sun, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { runtimeConfig } from "@/utils/runtime-config";

const Header = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const location = useLocation();
  const headerRef = useRef<HTMLElement>(null);
  const [theme, setTheme] = useState<"light" | "dark">(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("theme");
      if (saved === "light" || saved === "dark") return saved;
      return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
    }
    return "dark";
  });

  // Close mobile menu when clicking outside the header
  useEffect(() => {
    if (!isMenuOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (headerRef.current && !headerRef.current.contains(event.target as Node)) {
        setIsMenuOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isMenuOpen]);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
    localStorage.setItem("theme", theme);
  }, [theme]);

  const navLinks = [
    { label: "Integrations", href: "/integrations", external: false },
    { label: "API Reference", href: runtimeConfig.apiDocsUrl, external: true },
    { label: "GitHub", href: "https://github.com/EnvSync-Cloud/envsync", external: true },
  ];

  return (
    <header ref={headerRef} className="sticky top-0 z-50 w-full border-b border-border bg-background/90 backdrop-blur-xl">
      <div className="container mx-auto border-x border-border px-0">
        <div className="flex h-16 items-center justify-between">
          <Link to="/" className="ml-4 flex items-center space-x-2">
            <img src="/EnvSync.svg" alt="EnvSync Logo" className="h-8 w-8" />
            <span className="text-xl font-bold text-foreground">EnvSync</span>
            <Badge className="rounded-none border border-sky-500/60 bg-sky-500/15 px-2 py-1 text-xs font-bold text-sky-300 hover:bg-sky-500/20">
              BETA
            </Badge>
          </Link>

          <nav className="hidden h-full items-center gap-5 md:flex">
            {navLinks.map((link) =>
              link.external ? (
                <a
                  key={link.label}
                  href={link.href}
                  className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
                >
                  {link.label}
                </a>
              ) : (
                <Link
                  key={link.label}
                  to={link.href}
                  className={`text-sm font-medium transition-colors ${
                    location.pathname === link.href
                      ? "text-primary"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {link.label}
                </Link>
              ),
            )}
            <button
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
              className="rounded-md p-2 text-muted-foreground hover:text-foreground"
              aria-label="Toggle theme"
            >
              {theme === "dark" ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
            </button>
            <a href={runtimeConfig.appBaseUrl} className="h-full">
              <Button
                variant="outline"
                className="h-full border-border bg-[hsl(var(--surface-1))] px-5 text-foreground hover:bg-accent"
              >
                Sign In
              </Button>
            </a>
            <Link to="/onboarding" className="h-full !ml-0">
              <Button className="h-full px-6 text-primary-foreground hover:bg-primary/90">
                Get Started
              </Button>
            </Link>
          </nav>

          <div className="mr-4 md:hidden">
            <button
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className="text-muted-foreground hover:text-foreground"
              aria-expanded={isMenuOpen}
              aria-label={isMenuOpen ? "Close menu" : "Open menu"}
            >
              {isMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </button>
          </div>
        </div>

        {isMenuOpen && (
          <div className="border-t border-border py-4 md:hidden">
            <nav className="flex flex-col space-y-4">
              {navLinks.map((link) =>
                link.external ? (
                  <a
                    key={link.label}
                    href={link.href}
                    className="text-muted-foreground transition-colors hover:text-foreground"
                  >
                    {link.label}
                  </a>
                ) : (
                  <Link
                    key={link.label}
                    to={link.href}
                    className={`transition-colors ${
                      location.pathname === link.href
                        ? "text-primary"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                    onClick={() => setIsMenuOpen(false)}
                  >
                    {link.label}
                  </Link>
                ),
              )}
              <div className="flex flex-col space-y-2 pt-4">
                <button
                  onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
                  className="flex items-center gap-2 rounded-md px-4 py-2 text-muted-foreground hover:text-foreground"
                  aria-label="Toggle theme"
                >
                  {theme === "dark" ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
                  <span>{theme === "dark" ? "Light mode" : "Dark mode"}</span>
                </button>
                <a href={runtimeConfig.appBaseUrl}>
                  <Button variant="outline" className="w-full justify-start border-border bg-card text-foreground hover:bg-accent">
                    Sign In
                  </Button>
                </a>
                <Link to="/onboarding">
                  <Button className="w-full justify-start bg-primary text-primary-foreground hover:bg-primary/90">
                    Get Started
                  </Button>
                </Link>
              </div>
            </nav>
          </div>
        )}
      </div>
    </header>
  );
};

export default Header;
