import { Button, ThemeToggle } from "@/components/primitives";
import { ChevronDown, Menu, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { trackAction } from "@/telemetry";
import { runtimeConfig } from "@/utils/runtime-config";
import { navGroups, pathInGroup, standaloneNav, type NavGroup } from "@/nav";

const linkClasses =
  "rounded-md px-3 py-1.5 text-base font-medium text-muted-foreground " +
  "transition-colors duration-200 ease-[cubic-bezier(0.19,1,0.22,1)] hover:text-foreground " +
  "focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-accent-outline/35";

const Header = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [openGroup, setOpenGroup] = useState<string | null>(null);
  const location = useLocation();
  const headerRef = useRef<HTMLElement>(null);

  useEffect(() => {
    setOpenGroup(null);
    setIsMenuOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!isMenuOpen && !openGroup) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (headerRef.current && !headerRef.current.contains(event.target as Node)) {
        setIsMenuOpen(false);
        setOpenGroup(null);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isMenuOpen, openGroup]);

  return (
    <header
      ref={headerRef}
      className="sticky top-0 z-50 w-full border-b border-border bg-background"
    >
      <div className="mx-auto flex h-[72px] max-w-[1480px] items-center justify-between px-4 sm:px-8">
        <Link to="/" className="flex items-center gap-2">
          <img src="/EnvSync.svg" alt="EnvSync Logo" className="h-7 w-7" />
          <span className="text-base font-medium text-foreground">EnvSync</span>
          <span className="rounded-full border border-border px-2 py-0.5 font-mono text-xs leading-4 text-muted-foreground">
            BETA
          </span>
        </Link>

        <nav className="hidden h-full items-center gap-1 md:flex">
          {navGroups.map((group) => (
            <NavDropdown
              key={group.id}
              group={group}
              open={openGroup === group.id}
              onOpen={() => setOpenGroup(group.id)}
              onClose={() => setOpenGroup(null)}
              pathname={location.pathname}
            />
          ))}
          {standaloneNav.map((link) =>
            link.external ? (
              <a key={link.label} href={link.href} className={linkClasses}>
                {link.label}
              </a>
            ) : (
              <Link key={link.label} to={link.href} className={linkClasses}>
                {link.label}
              </Link>
            ),
          )}
        </nav>

        <div className="hidden items-center gap-2 md:flex">
          <ThemeToggle />
          <a href={runtimeConfig.appBaseUrl}>
            <Button variant="outline" size="sm">
              Sign In
            </Button>
          </a>
          <Link to="/onboarding" onClick={() => trackAction("landing_cta_clicked", { placement: "header" })}>
            <Button variant="nav-cta" size="sm">
              Get Started
            </Button>
          </Link>
        </div>

        <button
          onClick={() => setIsMenuOpen(!isMenuOpen)}
          className="text-muted-foreground hover:text-foreground md:hidden"
          aria-expanded={isMenuOpen}
          aria-label={isMenuOpen ? "Close menu" : "Open menu"}
        >
          {isMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>
      </div>

      {isMenuOpen && (
        <div className="border-t border-border bg-background md:hidden">
          <nav className="flex flex-col gap-4 px-4 py-4">
            {navGroups.map((group) => (
              <div key={group.id}>
                <p className="font-mono text-xs uppercase tracking-[0.16em] text-tertiary">{group.label}</p>
                <div className="mt-2 flex flex-col">
                  {group.items.map((item) => (
                    <Link
                      key={item.href}
                      to={item.href}
                      className={`${linkClasses} ${location.pathname === item.href ? "!text-foreground" : ""}`}
                      onClick={() => {
                        trackAction("landing_nav_clicked", { group: group.id, href: item.href });
                        setIsMenuOpen(false);
                      }}
                    >
                      {item.label}
                    </Link>
                  ))}
                </div>
              </div>
            ))}
            {standaloneNav.map((link) =>
              link.external ? (
                <a key={link.label} href={link.href} className={linkClasses}>
                  {link.label}
                </a>
              ) : (
                <Link key={link.label} to={link.href} className={linkClasses} onClick={() => setIsMenuOpen(false)}>
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

function NavDropdown({
  group,
  open,
  onOpen,
  onClose,
  pathname,
}: {
  group: NavGroup;
  open: boolean;
  onOpen: () => void;
  onClose: () => void;
  pathname: string;
}) {
  const active = pathInGroup(pathname, group);
  return (
    <div className="relative h-full" onMouseEnter={onOpen} onMouseLeave={onClose}>
      <button
        type="button"
        className={`${linkClasses} inline-flex h-full items-center gap-1 ${active || open ? "!text-foreground" : ""}`}
        aria-expanded={open}
        data-testid={`landing-nav-${group.id}`}
        onClick={() => (open ? onClose() : onOpen())}
      >
        {group.label}
        <ChevronDown className={`h-3.5 w-3.5 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open ? (
        <div className="absolute left-0 top-full z-50 min-w-[240px] border border-border bg-popover py-2">
          {group.items.map((item) => (
            <Link
              key={item.href}
              to={item.href}
              className={`block px-4 py-2 text-sm text-muted-foreground hover:bg-card hover:text-foreground ${
                pathname === item.href ? "!text-foreground" : ""
              }`}
              data-testid={`landing-nav-${group.id}-${item.href.replace(/\//g, "-")}`}
              onClick={() => {
                trackAction("landing_nav_clicked", { group: group.id, href: item.href });
                onClose();
              }}
            >
              {item.label}
            </Link>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export default Header;
