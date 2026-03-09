import { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { ArrowRight, Github } from "lucide-react";
import Globe from "./Globe";
import { Link } from "react-router-dom";
import { getLatestBlog } from "@/helpers/get-latest-blog";
import { Spotlight } from "./ui/spotlight";
import { motion } from "framer-motion";

interface BlogPost {
  id: string;
  Published: string;
  Slug: string;
  Date: number;
  Authors: string[];
  Page: string;
  preview: string[][][];
}

const Hero = () => {
  const [latestBlog, setLatestBlog] = useState<BlogPost | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchLatestBlog = async () => {
      try {
        const blog = await getLatestBlog();
        if (blog) {
          setLatestBlog(blog);
        }
      } catch (error) {
        console.error('Failed to fetch latest blog:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchLatestBlog();
  }, []);

  const handleBlogClick = () => {
    if (latestBlog) {
      window.open(`https://blog.envsync.cloud/blog/${latestBlog.Slug}`, '_blank');
    }
  };

  return (
    <section className="min-h-[100dvh] w-full flex items-center justify-center bg-slate-950 relative overflow-hidden antialiased py-20 lg:py-0">
      <Spotlight
        className="-top-40 left-0 md:left-60 lg:left-0 lg:-top-20"
        fill="white"
      />
      
      {/* Background grid for subtle texture */}
      <div className="absolute inset-0 bg-grid-white/[0.02] bg-[size:60px_60px] pointer-events-none" />
      
      <div className="relative container mx-auto px-4 sm:px-6 lg:px-8 z-20 flex flex-col lg:flex-row items-center justify-between gap-8 lg:gap-12 min-h-0 py-12 lg:py-0">
        
        {/* Main Text Content */}
        <div className="flex-1 flex flex-col items-center lg:items-start text-center lg:text-left z-20 mt-16 md:mt-24 lg:mt-0 max-w-2xl mx-auto lg:mx-0">
          
          {/* Latest blog post section */}
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="mb-8 w-full flex justify-center lg:justify-start"
          >
            {isLoading ? (
              <div className="inline-flex items-center px-4 py-2 rounded-full bg-slate-900 border border-slate-800 text-slate-400 text-sm font-medium shadow-sm">
                <svg className="animate-spin -ml-1 mr-3 h-4 w-4 text-emerald-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="m4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <span>Loading latest post...</span>
              </div>
            ) : latestBlog ? (
              <button
                onClick={handleBlogClick}
                className="inline-flex items-center px-4 py-2 rounded-full bg-slate-900/50 backdrop-blur-sm border border-slate-800 text-slate-300 text-sm font-medium hover:bg-slate-800 hover:text-white transition-all duration-300 cursor-pointer group shadow-xl"
              >
                <span className="relative flex size-2 mr-3 shrink-0">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex size-2 rounded-full bg-emerald-500"></span>
                </span>
                <span className="font-semibold text-xs md:text-sm tracking-wide truncate max-w-[200px] sm:max-w-xs md:max-w-sm">
                  Latest: {latestBlog.preview[0]?.[0]?.[0] || latestBlog.Page}
                </span>
                <ArrowRight className="ml-2 h-3.5 w-3.5 transition-transform group-hover:translate-x-1 shrink-0" />
              </button>
            ) : null}
          </motion.div>

          <motion.h1 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
            className="text-4xl sm:text-5xl md:text-6xl lg:text-5xl xl:text-6xl font-bold bg-clip-text text-transparent bg-gradient-to-b from-neutral-50 to-neutral-500 mb-6 lg:mb-8 leading-[1.1] tracking-tight"
          >
            Sync your secrets, <br className="hidden sm:block" />
            <span className="bg-gradient-to-r from-emerald-400 to-blue-400 bg-clip-text text-transparent pb-2 block">
              secure your apps.
            </span>
          </motion.h1>
          
          <motion.p 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.4 }}
            className="text-lg sm:text-xl lg:text-2xl text-neutral-400 mb-10 lg:mb-12 max-w-2xl leading-relaxed font-light"
          >
            EnvSync is the modern enterprise alternative to Doppler and Vault. 
            Manage environment variables across all your applications.
          </motion.p>
          
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.5 }}
            className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start items-center w-full lg:w-auto"
          >
            <Link to="/onboarding" className="w-full sm:w-auto">
              <Button size="lg" className="w-full bg-emerald-600 hover:bg-emerald-500 text-white px-8 py-6 text-lg font-medium shadow-[0_0_40px_-10px_rgba(16,185,129,0.5)] transition-all">
                Get Started for Free
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </Link>
            <Link to="https://github.com/envsync-cloud" className="w-full sm:w-auto">
              <Button 
                size="lg" 
                variant="outline" 
                className="w-full border-slate-800 bg-slate-900/50 backdrop-blur-md px-8 py-6 text-lg text-slate-300 hover:text-white hover:bg-slate-800 hover:border-slate-700 transition-all"
              >
                <Github className="mr-2 h-5 w-5" />
                View on GitHub
              </Button>
            </Link>
          </motion.div>
        </div>

        {/* Globe Section */}
        <div className="flex-1 w-full max-w-3xl lg:max-w-none relative z-0 flex items-center justify-center lg:justify-end pointer-events-none mt-12 lg:mt-0">
          <Globe />
        </div>
        
      </div>
    </section>
  );
};

export default Hero;
