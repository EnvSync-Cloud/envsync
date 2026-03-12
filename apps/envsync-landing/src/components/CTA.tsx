import { Button } from "@/components/ui/button";
import { ArrowRight, CheckCircle } from "lucide-react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";

const CTA = () => {
  return (
    <section className="container mx-auto border-x border-t border-border p-0">
      <div className="relative container mx-auto px-0 z-10">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.35 }}
          className="relative w-full overflow-hidden border border-border bg-[hsl(var(--surface-1))] p-7 text-left md:p-10"
        >
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 opacity-45"
            style={{
              backgroundImage:
                "linear-gradient(hsl(var(--border) / 0.7) 1px, transparent 1px), linear-gradient(90deg, hsl(var(--border) / 0.7) 1px, transparent 1px)",
              backgroundSize: "36px 36px",
            }}
          />
          <div className="relative z-10">
            <h2 className="mb-4 text-4xl font-bold leading-tight tracking-tight text-foreground md:text-5xl lg:text-6xl">
              Ready to secure your environment variables?
            </h2>

            <p className="mb-8 max-w-2xl text-lg text-muted-foreground md:text-xl">
              Give your team a secure, fast control plane for environment configuration.
            </p>

            <div className="mb-8 flex flex-col items-start gap-4 sm:flex-row">
              <Link to="/onboarding" className="w-full sm:w-auto">
                <Button size="lg" className="w-full px-8 text-base">
                  Start for Free
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
              <Link
                to="https://calendly.com/bravo68web/envsync-intro-clone"
                className="w-full sm:w-auto"
              >
                <Button
                  size="lg"
                  variant="outline"
                  className="w-full px-8 text-base"
                >
                  Contact Sales
                </Button>
              </Link>
            </div>

            <div className="grid grid-cols-1 gap-3 border border-border bg-[hsl(var(--surface-2))] p-4 text-sm font-medium text-muted-foreground sm:grid-cols-3 md:text-base">
              <div className="flex items-center">
                <CheckCircle className="mr-2 h-5 w-5 text-primary" />
                <span>Quick setup</span>
              </div>
              <div className="flex items-center">
                <CheckCircle className="mr-2 h-5 w-5 text-primary" />
                <span>No setup fees</span>
              </div>
              <div className="flex items-center">
                <CheckCircle className="mr-2 h-5 w-5 text-primary" />
                <span>Free forever tier</span>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
};

export default CTA;
