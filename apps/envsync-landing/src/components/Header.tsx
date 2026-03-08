
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
      transition={{ duration: 0.5 }}
      className="fixed top-0 w-full z-50 bg-slate-950/60 backdrop-blur-xl border-b border-white/[0.05]"
    >
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <Link to="/" className="flex items-center space-x-2">
            <img 
              src="/EnvSync.svg" 
              alt="EnvSync Logo" 
              className="h-8 w-8"
            />
            <span className="text-xl font-bold text-white">EnvSync</span>
            <Badge className="bg-orange-500 hover:bg-orange-600 text-white font-bold px-2 py-1 text-xs shadow-lg shadow-orange-500/50">
              ALPHA
            </Badge>
          </Link>
          
          <nav className="hidden md:flex items-center space-x-8">
            <Link 
              to="/about" 
              className={`transition-colors ${
                location.pathname === '/about' 
                  ? 'text-emerald-400' 
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              About
            </Link>
            <Link 
              to="/integrations" 
              className={`transition-colors ${
                location.pathname === '/integrations' 
                  ? 'text-emerald-400' 
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              Integrations
            </Link>
            <a href="https://blog.envsync.cloud" className="text-slate-300 hover:text-white transition-colors">Blog</a>
            <a href="https://app.envsync.cloud" className="text-slate-300 hover:text-white transition-colors">
              <Button variant="outline" className="border-slate-800 bg-slate-900/50 hover:bg-slate-800 hover:text-white transition-all">
                Sign In
              </Button>
            </a>
            <Link to="/onboarding">
              <Button className="bg-emerald-600 hover:bg-emerald-500 text-white shadow-[0_0_20px_-5px_rgba(16,185,129,0.4)] transition-all">
                Get Started
              </Button>
            </Link>
          </nav>

          <div className="md:hidden">
            <button
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className="text-slate-300 hover:text-white"
            >
              {isMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </button>
          </div>
        </div>

        {isMenuOpen && (
          <div className="md:hidden py-4 border-t border-slate-800">
            <nav className="flex flex-col space-y-4">
              <Link 
                to="/about" 
                className={`transition-colors ${
                  location.pathname === '/about' 
                    ? 'text-emerald-400' 
                    : 'text-slate-300 hover:text-white'
                }`}
                onClick={() => setIsMenuOpen(false)}
              >
                About
              </Link>
              <Link 
                to="/integrations" 
                className={`transition-colors ${
                  location.pathname === '/integrations' 
                    ? 'text-emerald-400' 
                    : 'text-slate-300 hover:text-white'
                }`}
                onClick={() => setIsMenuOpen(false)}
              >
                Integrations
              </Link>
              <a href="https://blog.envsync.cloud" className="text-slate-300 hover:text-white transition-colors">Blog</a>
              <div className="flex flex-col space-y-2 pt-4">
                <Button variant="outline" className="border-slate-800 bg-slate-900/50 hover:bg-slate-800 hover:text-white transition-all text-left justify-start">
                  Sign In
                </Button>
                <Link to="/onboarding">
                  <Button className="w-full bg-emerald-600 hover:bg-emerald-500 text-white shadow-[0_0_20px_-5px_rgba(16,185,129,0.4)] transition-all justify-start">
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
