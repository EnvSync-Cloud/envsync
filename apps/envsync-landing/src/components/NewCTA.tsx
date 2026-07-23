import { Button } from "@/components/primitives/Button"
import { DotTexture } from "@/components/primitives/DotTexture"
import { Github } from "lucide-react"
import { Link } from "react-router-dom"

const NewCTA = () => {
  return (
    <section className="bg-background px-2 pb-2 md:px-3 md:pb-3">
      <div className="relative overflow-hidden rounded-lg bg-primary">
        {/* Dot texture + bottom radial glow */}
        <DotTexture />

        {/* Content */}
        <div className="relative z-10 mx-auto max-w-[1080px] px-6 py-24 text-center md:py-32">
          <h2 className="text-h1 font-medium text-hero-text text-balance">
            Ready to stop the .env chaos?
          </h2>
          <p className="mt-6 text-lead text-hero-text/85">
            Start for free. No credit card required. Self-host or use our
            managed service.
          </p>
          <div className="mt-10 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
            <Link to="/onboarding">
              <Button variant="hero" size="lg">
                Get started
              </Button>
            </Link>
            <a href="https://github.com/EnvSync-Cloud/envsync">
              <Button
                variant="hero"
                size="lg"
                className="border-hero-text bg-transparent text-hero-text hover:opacity-95"
              >
                <Github className="h-4 w-4" />
                Star on GitHub
              </Button>
            </a>
          </div>
        </div>
      </div>
    </section>
  )
}

export default NewCTA
