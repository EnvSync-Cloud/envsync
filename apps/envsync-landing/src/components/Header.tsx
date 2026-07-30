import { Button, ThemeToggle } from "@/components/primitives";
import { Menu, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { runtimeConfig } from "@/utils/runtime-config";

const navLinks = [
  { label: "Integrations", href: "/integrations", external: false },
  { label: "API Reference", href: runtimeConfig.apiDocsUrl, external: true },
  { label: "GitHub", href: "https://github.com/EnvSync-Cloud/envsync", external: true },
] as const;

const linkClasses =
  "rounded-md px-3 py-1.5 text-base font-medium text-muted-foreground " +
  "transition-colors duration-200 ease-[cubic-bezier(0.19,1,0.22,1)] hover:text-foreground " +
  "focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-accent-outline/35";

const Header = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const location = useLocation();
  const headerRef = useRef<HTMLElement>(null);

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

  return (
    <header
      ref={headerRef}
      className="sticky top-0 z-50 w-full border-b border-border bg-background"
    >
      <div className="mx-auto flex h-[72px] max-w-[1480px] items-center justify-between px-4 sm:px-8">
        {/* Logo */}
        <Link to="/" className="flex items-center gap-2">
          <img src="/EnvSync.svg" alt="EnvSync Logo" className="h-7 w-7" />
          <span className="text-base font-medium text-foreground">EnvSync</span>
          <span className="rounded-full border border-border px-2 py-0.5 font-mono text-xs leading-4 text-muted-foreground">
            BETA
          </span>
        </Link>

        {/* Center nav — desktop */}
        <nav className="hidden h-full items-center gap-1 md:flex">
          {navLinks.map((link) =>
            link.external ? (
              <a key={link.label} href={link.href} className={linkClasses}>
                {link.label}
              </a>
            ) : (
              <Link
                key={link.label}
                to={link.href}
                className={`${linkClasses} ${
                  location.pathname === link.href ? "!text-foreground" : ""
                }`}
              >
                {link.label}
              </Link>
            ),
          )}
        </nav>

        {/* Right cluster — desktop */}
        <div className="hidden items-center gap-2 md:flex">
          <ThemeToggle />
          <a href={runtimeConfig.appBaseUrl}>
            <Button variant="outline" size="sm">
              Sign In
            </Button>
          </a>
          <Link to="/onboarding">
            <Button variant="nav-cta" size="sm">
              Get Started
            </Button>
          </Link>
        </div>

        {/* Hamburger — mobile */}
        <button
          onClick={() => setIsMenuOpen(!isMenuOpen)}
          className="text-muted-foreground hover:text-foreground md:hidden"
          aria-expanded={isMenuOpen}
          aria-label={isMenuOpen ? "Close menu" : "Open menu"}
        >
          {isMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>
      </div>

      {/* Mobile dropdown */}
      {isMenuOpen && (
        <div className="border-t border-border bg-background md:hidden">
          <nav className="flex flex-col gap-1 px-4 py-4">
            {navLinks.map((link) =>
              link.external ? (
                <a key={link.label} href={link.href} className={linkClasses}>
                  {link.label}
                </a>
              ) : (
                <Link
                  key={link.label}
                  to={link.href}
                  className={`${linkClasses} ${
                    location.pathname === link.href ? "!text-foreground" : ""
                  }`}
                  onClick={() => setIsMenuOpen(false)}
                >
                  {link.label}
                </Link>
              ),
            )}
          </nav>
          <div className="flex flex-col gap-2 border-t border-border px-4 py-4">
            <a href={runtimeConfig.appBaseUrl}>
              <Button variant="outline" size="sm" className="w-full">
                Sign In
              </Button>
            </a>
            <Link to="/onboarding">
              <Button variant="nav-cta" size="sm" className="w-full">
                Get Started
              </Button>
            </Link>
            <div className="flex justify-center pt-2">
              <ThemeToggle />
            </div>
          </div>
        </div>
      )}
    </header>
  );
};

export default Header;
