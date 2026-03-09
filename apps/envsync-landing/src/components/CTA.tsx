import { Button } from "@/components/ui/button";
import { ArrowRight, CheckCircle } from "lucide-react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";

const CTA = () => {
  return (
    <section className="py-32 bg-slate-950 border-t border-white/[0.05] relative overflow-hidden">
      {/* Abstract beams */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-[1px] bg-gradient-to-r from-transparent via-emerald-500/50 to-transparent" />
      <div className="absolute inset-0 bg-grid-white/[0.02] bg-[size:40px_40px] pointer-events-none" />
      
      {/* Glow Center */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-emerald-500/10 rounded-full blur-[120px] pointer-events-none" />
      
      <div className="relative container mx-auto px-4 sm:px-6 lg:px-8 z-10">
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="max-w-4xl mx-auto text-center"
        >
          <h2 className="text-4xl md:text-5xl lg:text-6xl font-bold text-white mb-6 tracking-tight leading-tight">
            Ready to secure your <br />
            <span className="bg-gradient-to-r from-emerald-400 to-blue-400 bg-clip-text text-transparent">
              environment variables?
            </span>
          </h2>
          
          <p className="text-xl md:text-2xl text-neutral-400 mb-12 max-w-2xl mx-auto font-light">
            Join thousands of developers who trust EnvSync to keep their secrets safe. 
            Experience the difference today.
          </p>
          
          <div className="flex flex-col sm:flex-row gap-6 justify-center items-center mb-16">
            <Link to="/onboarding" className="w-full sm:w-auto">
              <Button size="lg" className="w-full bg-emerald-600 hover:bg-emerald-500 text-white px-8 py-6 text-lg font-medium shadow-[0_0_40px_-10px_rgba(16,185,129,0.5)] transition-all">
                Start for Free
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </Link>
            <Link to="https://calendly.com/bravo68web/envsync-intro-clone" className="w-full sm:w-auto">
            <Button
              size="lg" 
              variant="outline" 
              className="w-full border-slate-700 bg-slate-900/50 backdrop-blur-md px-8 py-6 text-lg text-slate-300 hover:text-white hover:bg-slate-800 hover:border-slate-600 transition-all font-medium"
            >
              Contact Sales
            </Button>
            </Link>
          </div>
          
          <div className="flex flex-col sm:flex-row items-center justify-center space-y-4 sm:space-y-0 sm:space-x-10 text-neutral-400 font-medium text-sm md:text-base">
            <div className="flex items-center">
              <CheckCircle className="h-5 w-5 text-emerald-500 mr-2" />
              <span>Quick setup</span>
            </div>
            <div className="flex items-center">
              <CheckCircle className="h-5 w-5 text-emerald-500 mr-2" />
              <span>No setup fees</span>
            </div>
            <div className="flex items-center">
              <CheckCircle className="h-5 w-5 text-emerald-500 mr-2" />
              <span>Free forever tier</span>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
};

export default CTA;
