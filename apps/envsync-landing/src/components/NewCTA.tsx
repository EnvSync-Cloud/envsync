import { Button } from "@/components/ui/button";
import { ArrowRight, Github } from "lucide-react";
import { Link } from "react-router-dom";

const NewCTA = () => {
  return (
    <section className="border-b border-border bg-background">
      <div className="container mx-auto px-4 py-24 md:px-8 md:py-32">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-bold tracking-tight text-foreground md:text-4xl">
            Ready to stop the .env chaos?
          </h2>
          <p className="mt-4 text-lg text-muted-foreground">
            Start for free. No credit card required. Self-host or use our managed service.
          </p>
          <div className="mt-10 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
            <Link to="/onboarding">
              <Button size="lg" className="gap-2 px-8 text-base">
                Get started
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
            <a href="https://github.com/EnvSync-Cloud/envsync">
              <Button size="lg" variant="outline" className="gap-2 px-8 text-base">
                <Github className="h-4 w-4" />
                Star on GitHub
              </Button>
            </a>
          </div>
        </div>
      </div>
    </section>
  );
};

export default NewCTA;
