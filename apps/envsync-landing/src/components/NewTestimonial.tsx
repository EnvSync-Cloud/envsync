import { BeamCard } from "@/components/primitives/BeamCard"

const NewTestimonial = () => {
  return (
    <section className="border-t border-border bg-background bg-grid-box">
      <div className="mx-auto max-w-[1280px] px-4 py-16 sm:px-8 md:py-24">
        <div className="mx-auto max-w-3xl">
          <BeamCard active>
            <blockquote className="text-h2 font-medium text-foreground text-balance">
              &ldquo;EnvSync eliminated our .env file chaos overnight. We went
              from 3-hour config debugging sessions to zero incidents. The
              approval gates alone saved us from two production outages.&rdquo;
            </blockquote>
            <footer className="mt-8 flex items-center gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-accent-tint/15 font-mono text-sm text-accent-ink">
                SK
              </div>
              <div>
                <div className="text-base font-medium text-foreground">
                  Sarah Kim
                </div>
                <div className="text-sm text-muted-foreground">
                  Platform Lead, Streamline
                </div>
              </div>
            </footer>
          </BeamCard>
        </div>
      </div>
    </section>
  )
}

export default NewTestimonial
