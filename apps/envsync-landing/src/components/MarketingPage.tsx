import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { Button } from "@/components/primitives/Button";
import NewCTA from "@/components/NewCTA";
import type { MarketingDoc } from "@/content/marketing";
import { Link } from "react-router-dom";
import { useState } from "react";

const FALLBACK_ART = "/images/illustrations/collab.png";

const MarketingPage = ({ doc }: { doc: MarketingDoc }) => {
  const isExternalCta = doc.ctaHref.startsWith("http") || doc.ctaHref.startsWith("mailto:");
  const [art, setArt] = useState(doc.illustration);

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main id="main-content">
        <section className="border-b border-border">
          <div className="mx-auto grid max-w-[1080px] items-center gap-10 px-4 py-16 sm:px-8 md:grid-cols-2 md:py-24">
            <div>
              <p className="font-mono text-xs uppercase tracking-[0.16em] text-accent-ink">{doc.eyebrow}</p>
              <h1 className="mt-4 text-balance text-4xl font-medium tracking-tight text-foreground md:text-5xl">
                {doc.title}
              </h1>
              <p className="mt-6 text-lead text-muted-foreground">{doc.lead}</p>
              <div className="mt-8">
                {isExternalCta ? (
                  <a href={doc.ctaHref}>
                    <Button variant="nav-cta" size="sm">
                      {doc.ctaLabel}
                    </Button>
                  </a>
                ) : (
                  <Link to={doc.ctaHref}>
                    <Button variant="nav-cta" size="sm">
                      {doc.ctaLabel}
                    </Button>
                  </Link>
                )}
              </div>
            </div>
            <div className="overflow-hidden rounded-lg border border-border bg-[#EDECE1]">
              <img
                src={art}
                alt={doc.illustrationAlt}
                className="aspect-square w-full object-cover"
                onError={() => setArt(FALLBACK_ART)}
              />
            </div>
          </div>
        </section>

        <section className="border-b border-border">
          <div className="mx-auto grid max-w-[1080px] gap-6 px-4 py-16 sm:px-8 md:grid-cols-3">
            {doc.capabilities.map((cap) => (
              <div key={cap.title} className="rounded-lg border border-border bg-card p-6">
                <h2 className="text-h3 font-medium text-foreground">{cap.title}</h2>
                <p className="mt-3 text-base text-muted-foreground">{cap.body}</p>
              </div>
            ))}
          </div>
        </section>

        <section>
          <div className="mx-auto max-w-[1080px] px-4 py-16 sm:px-8">
            <p className="font-mono text-xs uppercase tracking-[0.16em] text-accent-ink">How teams use it</p>
            <ol className="mt-8 grid gap-6 md:grid-cols-3">
              {doc.steps.map((step, index) => (
                <li key={step.title} className="rounded-lg border border-border bg-card p-6">
                  <span className="font-mono text-sm text-accent-ink">{String(index + 1).padStart(2, "0")}</span>
                  <h3 className="mt-3 text-h3 font-medium text-foreground">{step.title}</h3>
                  <p className="mt-2 text-base text-muted-foreground">{step.body}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>
        <NewCTA />
      </main>
      <Footer />
    </div>
  );
};

export default MarketingPage;
