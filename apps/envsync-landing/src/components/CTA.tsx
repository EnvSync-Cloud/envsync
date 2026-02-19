
import { Button } from "@/components/ui/button";
import { ArrowRight, CheckCircle } from "lucide-react";
import { Link } from "react-router-dom";

const CTA = () => {
  return (
    <section className="py-24 bg-gradient-to-br from-slate-800 to-slate-900 relative overflow-hidden">
      <div className="absolute inset-0 bg-grid-white/[0.02] bg-[size:40px_40px]" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-emerald-500/10 rounded-full blur-3xl" />
      
      <div className="relative container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-4xl md:text-5xl font-bold text-white mb-6">
            Ready to secure your
            <br />
            <span className="bg-gradient-to-r from-emerald-400 to-blue-400 bg-clip-text text-transparent">
              environment variables?
            </span>
          </h2>
          
          <p className="text-xl text-slate-300 mb-10 max-w-2xl mx-auto">
            Join thousands of developers who trust EnvSync to keep their secrets safe. 
            Get started today and experience the difference.
          </p>
          
          <div className="flex flex-col sm:flex-row gap-6 justify-center items-center mb-12">
            <Link to="/onboarding">
              <Button size="lg" className="bg-emerald-600 hover:bg-emerald-700 text-white px-8 py-4 text-lg font-semibold">
                Get Started
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </Link>
            <Link to="https://calendly.com/bravo68web/envsync-intro-clone">
            <Button
              size="lg" 
              variant="outline" 
              className="border-slate-700 bg-transparent hover:bg-slate-800 px-8 py-4 text-lg text-slate-300 hover:text-white"
            >
              Schedule demo
            </Button>
            </Link>
          </div>
          
          <div className="flex flex-col sm:flex-row items-center justify-center space-y-4 sm:space-y-0 sm:space-x-8 text-slate-300">
            <div className="flex items-center">
              <CheckCircle className="h-5 w-5 text-emerald-400 mr-2" />
              <span>Quick setup</span>
            </div>
            <div className="flex items-center">
              <CheckCircle className="h-5 w-5 text-emerald-400 mr-2" />
              <span>No setup fees</span>
            </div>
            <div className="flex items-center">
              <CheckCircle className="h-5 w-5 text-emerald-400 mr-2" />
              <span>Start immediately</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default CTA;
