
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Menu, X } from "lucide-react";
import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { motion } from "framer-motion";

const Header = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const location = useLocation();

  return (
    <motion.header
      initial={{ y: -100 }}
      animate={{ y: 0 }}
      transition={{ duration: 0.35 }}
      className="fixed top-0 z-50 w-full border-b border-border bg-background/95"
    >
      <div className="container mx-auto border-x border-border px-0">
        <div className="flex justify-between items-center h-16">
          <Link to="/" className="flex items-center space-x-2">
            <img
              src="/EnvSync.svg"
              alt="EnvSync Logo"
              className="h-8 w-8"
            />
            <span className="text-xl font-bold text-foreground">EnvSync</span>
            <Badge className="rounded-none border border-orange-500/60 bg-orange-500/15 px-2 py-1 text-xs font-bold text-orange-300 hover:bg-orange-500/20">
              ALPHA
            </Badge>
          </Link>

          <nav className="hidden md:flex items-center space-x-8">
            <Link
              to="/about"
              className={`transition-colors ${
                location.pathname === "/about"
                  ? "text-primary"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              About
            </Link>
            <Link
              to="/integrations"
              className={`transition-colors ${
                location.pathname === "/integrations"
                  ? "text-primary"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Integrations
            </Link>
            <a
              href="https://blog.envsync.cloud"
              className="text-muted-foreground transition-colors hover:text-foreground"
            >
              Blog
            </a>
            <a href="https://app.envsync.cloud">
              <Button
                variant="outline"
                className="border-border bg-card text-foreground hover:bg-accent"
              >
                Sign In
              </Button>
            </a>
            <Link to="/onboarding">
              <Button className="bg-primary text-primary-foreground hover:bg-primary/90">
                Get Started
              </Button>
            </Link>
          </nav>

          <div className="md:hidden">
            <button
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className="text-muted-foreground hover:text-foreground"
            >
              {isMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </button>
          </div>
        </div>

        {isMenuOpen && (
          <div className="border-t border-border py-4 md:hidden">
            <nav className="flex flex-col space-y-4">
              <Link
                to="/about"
                className={`transition-colors ${
                  location.pathname === "/about"
                    ? "text-primary"
                    : "text-muted-foreground hover:text-foreground"
                }`}
                onClick={() => setIsMenuOpen(false)}
              >
                About
              </Link>
              <Link
                to="/integrations"
                className={`transition-colors ${
                  location.pathname === "/integrations"
                    ? "text-primary"
                    : "text-muted-foreground hover:text-foreground"
                }`}
                onClick={() => setIsMenuOpen(false)}
              >
                Integrations
              </Link>
              <a
                href="https://blog.envsync.cloud"
                className="text-muted-foreground transition-colors hover:text-foreground"
              >
                Blog
              </a>
              <div className="flex flex-col space-y-2 pt-4">
                <a href="https://app.envsync.cloud">
                  <Button
                    variant="outline"
                    className="w-full justify-start border-border bg-card text-foreground hover:bg-accent"
                  >
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
    </motion.header>
  );
};

export default Header;
