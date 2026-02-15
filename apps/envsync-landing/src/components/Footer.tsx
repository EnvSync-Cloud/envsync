
import { Github } from "lucide-react";
import { Badge } from "@/components/ui/badge";

const Footer = () => {
  return (
    <footer className="bg-slate-900 border-t border-slate-800">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          <div className="md:col-span-1">
            <div className="flex items-center space-x-2 mb-4">
              <img 
                src="/EnvSync.svg" 
                alt="EnvSync Logo" 
                className="h-8 w-8"
              />
              <span className="text-xl font-bold text-white">EnvSync</span>
              <Badge className="bg-orange-500 hover:bg-orange-600 text-white font-bold px-2 py-1 text-xs shadow-lg shadow-orange-500/50">
                ALPHA
              </Badge>
            </div>
            <p className="text-slate-300 mb-6">
              Secure environment management for modern development teams.
            </p>
            <div className="flex space-x-4">
              <a href="https://github.com/EnvSync-Cloud" className="text-slate-400 hover:text-emerald-400 transition-colors">
                <Github className="h-5 w-5" />
              </a>
            </div>
          </div>
          
          <div>
            <h3 className="text-white font-semibold mb-4">Product</h3>
            <ul className="space-y-2">
              <li><a href="/integrations" className="text-slate-300 hover:text-white transition-colors">Integrations</a></li>
            </ul>
          </div>
          
          <div>
            <h3 className="text-white font-semibold mb-4">Resources</h3>
            <ul className="space-y-2">
              <li><a href="https://blog.envsync.cloud" className="text-slate-300 hover:text-white transition-colors">Blog</a></li>
              <li><a href="https://api.envsync.cloud/docs" className="text-slate-300 hover:text-white transition-colors">API Reference</a></li>
            </ul>
          </div>
          
          <div>
            <h3 className="text-white font-semibold mb-4">Company</h3>
            <ul className="space-y-2">
              <li><a href="/about" className="text-slate-300 hover:text-white transition-colors">About</a></li>
              <li><a href="mailto:team@envsync.cloud" className="text-slate-300 hover:text-white transition-colors">Contact</a></li>
            </ul>
          </div>
        </div>
        
        <div className="border-t border-slate-800 pt-8 mt-8">
          <div className="flex flex-col md:flex-row justify-between items-center">
            <p className="text-slate-400 text-sm">
              © 2025 EnvSync. All rights reserved.
            </p>
            <div className="flex space-x-6 mt-4 md:mt-0">
              {/* <a href="#" className="text-slate-400 hover:text-white text-sm transition-colors">Terms of Service</a>
              <a href="#" className="text-slate-400 hover:text-white text-sm transition-colors">Privacy Policy</a> */}
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
