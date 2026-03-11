import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { ArrowRight, Github, KeyRound, ShieldCheck, Terminal, Workflow } from "lucide-react";
import { Link } from "react-router-dom";
import { getLatestBlog } from "@/helpers/get-latest-blog";
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
        console.error("Failed to fetch latest blog:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchLatestBlog();
  }, []);

  const handleBlogClick = () => {
    if (latestBlog) {
      window.open(
        `https://blog.envsync.cloud/blog/${latestBlog.Slug}`,
        "_blank",
      );
    }
  };

  return (
    <section className="container mx-auto min-h-[100dvh] border-x border-border pt-20 md:pt-24">
      <div className="container mx-auto grid min-h-[calc(100dvh-5rem)] grid-cols-1 gap-0 px-0 py-8 lg:grid-cols-2 lg:py-14">
        <div className="flex flex-col justify-center border border-border p-6 md:p-8">
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, delay: 0.1 }}
            className="mb-5"
          >
            {isLoading ? (
              <div className="inline-flex items-center border border-border bg-card px-3 py-2 text-sm text-muted-foreground">
                <svg
                  className="animate-spin -ml-1 mr-3 h-4 w-4 text-emerald-400"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  ></circle>
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="m4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  ></path>
                </svg>
                <span>Loading latest post...</span>
              </div>
            ) : latestBlog ? (
              <button
                onClick={handleBlogClick}
                className="group inline-flex items-center border border-border bg-card px-3 py-2 text-left text-sm text-muted-foreground transition-colors hover:border-primary/60 hover:text-foreground"
              >
                <span className="mr-3 inline-block h-2 w-2 bg-primary" />
                <span className="max-w-[250px] truncate font-semibold tracking-wide">
                  Latest: {latestBlog.preview[0]?.[0]?.[0] || latestBlog.Page}
                </span>
                <ArrowRight className="ml-2 h-3.5 w-3.5 shrink-0 transition-transform group-hover:translate-x-1" />
              </button>
            ) : null}
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, delay: 0.2 }}
            className="mb-5 text-4xl font-bold leading-[1.04] tracking-tight text-foreground sm:text-5xl md:text-6xl"
          >
            Shipping secure apps
            <br className="hidden sm:block" />
            <span className="text-primary">starts with controlled secrets.</span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, delay: 0.3 }}
            className="mb-7 max-w-xl text-lg leading-relaxed text-muted-foreground sm:text-xl"
          >
            EnvSync gives your team one source of truth for environment variables across development,
            staging, and production with audit-ready access control.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, delay: 0.4 }}
            className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row"
          >
            <Link to="/onboarding" className="w-full sm:w-auto">
              <Button size="lg" className="w-full px-8 text-base">
                Get Started for Free
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
            <Link to="https://github.com/envsync-cloud" className="w-full sm:w-auto">
              <Button size="lg" variant="outline" className="w-full px-8 text-base">
                <Github className="h-4 w-4" />
                View on GitHub
              </Button>
            </Link>
          </motion.div>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, delay: 0.5 }}
          className="grid auto-rows-[9.5rem] grid-cols-2 gap-0"
        >
          <div className="col-span-2 border border-border bg-[hsl(var(--surface-1))] p-5">
            <p className="mb-2 text-xs uppercase tracking-[0.16em] text-muted-foreground">Deployment State</p>
            <p className="text-2xl font-semibold text-foreground">All environments in sync</p>
            <div className="mt-4 grid grid-cols-3 gap-2 text-sm">
              <div className="border border-border bg-[hsl(var(--surface-2))] p-2 text-center text-muted-foreground">dev</div>
              <div className="border border-primary/40 bg-[hsl(var(--surface-2))] p-2 text-center text-primary">staging</div>
              <div className="border border-border bg-[hsl(var(--surface-2))] p-2 text-center text-muted-foreground">prod</div>
            </div>
          </div>

          <div className="border border-border bg-[hsl(var(--surface-1))] p-4">
            <ShieldCheck className="mb-3 h-5 w-5 text-primary" />
            <p className="text-sm text-muted-foreground">Security</p>
            <p className="mt-1 text-lg font-semibold">End-to-end encrypted</p>
          </div>

          <div className="border border-border bg-[hsl(var(--surface-1))] p-4">
            <Workflow className="mb-3 h-5 w-5 text-primary" />
            <p className="text-sm text-muted-foreground">Workflow</p>
            <p className="mt-1 text-lg font-semibold">Versioned rollbacks</p>
          </div>

          <div className="border border-border bg-[hsl(var(--surface-1))] p-4">
            <KeyRound className="mb-3 h-5 w-5 text-primary" />
            <p className="text-sm text-muted-foreground">Secrets</p>
            <p className="mt-1 text-lg font-semibold">Centralized by app</p>
          </div>

          <div className="border border-border bg-[hsl(var(--surface-1))] p-4">
            <Terminal className="mb-3 h-5 w-5 text-primary" />
            <p className="text-sm text-muted-foreground">CLI</p>
            <p className="mt-1 font-mono text-sm text-foreground">envsync pull --env prod</p>
          </div>
        </motion.div>
      </div>
    </section>
  );
};

export default Hero;
