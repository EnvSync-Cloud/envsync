import { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { ArrowRight, Github } from "lucide-react";
import Globe from "./Globe";
import { Link } from "react-router-dom";
import { getLatestBlog } from "@/helpers/get-latest-blog";

// Interface for type safety based on your response structure
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
    <section className="h-fit bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 relative overflow-hidden">
      {/* Background effects */}
      <div className="absolute inset-0 bg-grid-white/[0.02] bg-[size:60px_60px]" />
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-emerald-500/20 rounded-full blur-3xl" />
      <div className="absolute top-1/4 right-1/4 w-[400px] h-[400px] bg-blue-500/10 rounded-full blur-3xl" />
      
      <div className="relative container mx-auto px-4 sm:px-6 lg:px-8 pt-32 pb-20">
                {/* Latest blog post section */}
        <div className="text-center mb-8">
          {isLoading ? (
            <div className="inline-flex items-center px-4 py-2 rounded-full bg-pink-500/20 border border-pink-500/40 text-pink-200 text-sm font-medium shadow-lg shadow-pink-500/50">
              <svg className="animate-spin -ml-1 mr-3 h-4 w-4 text-pink-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="m4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              <span>Loading latest post...</span>
            </div>
          ) : latestBlog ? (
            <button
              onClick={handleBlogClick}
              className="inline-flex items-center px-4 py-2 rounded-full bg-pink-500/20 border border-pink-500/40 text-pink-200 text-sm font-medium shadow-lg shadow-pink-500/50 hover:bg-pink-500/30 hover:border-pink-500/60 hover:shadow-xl hover:shadow-pink-500/60 transition-all duration-200 cursor-pointer group"
            >
              <span className="relative flex size-3 mr-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-pink-400 opacity-75 shadow-lg shadow-pink-500/50"></span>
                <span className="relative inline-flex size-3 rounded-full bg-pink-400 shadow-lg shadow-pink-500/50"></span>
              </span>
              <span className="group-hover:underline font-bold">
                Latest: {latestBlog.preview[0]?.[0]?.[0] || latestBlog.Page}
              </span>
              <svg 
                className="ml-2 h-3 w-3 transition-transform group-hover:translate-x-1 drop-shadow-sm" 
                fill="none" 
                stroke="currentColor" 
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          ) : null}
        </div>


        {/* Main content - horizontal on desktop, vertical on mobile */}
        <div className="flex flex-col lg:flex-row items-center gap-12 lg:gap-16">
          {/* Left side - Text content */}
          <div className="flex-1 text-center lg:text-left">
            <h1 className="text-5xl md:text-6xl lg:text-7xl font-bold text-white mb-6 leading-tight">
              Sync your secrets,
              <br />
              <span className="bg-gradient-to-r from-emerald-400 to-blue-400 bg-clip-text text-transparent">
                secure your apps
              </span>
            </h1>
            
            <p className="text-xl text-slate-300 mb-10 max-w-2xl lg:max-w-none leading-relaxed">
              EnvSync is the modern alternative to Doppler and Vault. Manage environment variables, 
              secrets, and configurations across all your applications with military-grade security.
            </p>
            
            <div className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start items-center">
              <Link to="/onboarding">
                <Button size="lg" className="bg-emerald-600 hover:bg-emerald-700 text-white px-8 py-4 text-lg font-semibold">
                  Get Started
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
              </Link>
              <Link to="https://github.com/envsync-cloud">
                <Button 
                  size="lg" 
                  variant="outline" 
                  className="border-slate-700 bg-transparent px-8 py-4 text-lg text-slate-300 hover:text-white hover:bg-slate-800"
                >
                  <Github className="mr-2 h-5 w-5" />
                  Checkout our GitHub
                </Button>
              </Link>
            </div>
          </div>

          {/* Right side - Globe with Team Activity */}
          <div className="flex-1 w-full">
            <Globe />
            <div className="text-center mt-8">
              <h3 className="text-white text-xl font-semibold mb-2">Global Team Collaboration</h3>
              <p className="text-slate-400">See your team's secret management activity in real-time</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Hero;
