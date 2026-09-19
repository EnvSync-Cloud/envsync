import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { Button } from "@/components/primitives/Button";
import { CropMarkFrame } from "@/components/primitives/CropMarkFrame";
import NewCTA from "@/components/NewCTA";
import type { MarketingDoc } from "@/content/marketing";
import { Link } from "react-router-dom";

const MarketingPage = ({ doc }: { doc: MarketingDoc }) => {
  const isExternalCta = doc.ctaHref.startsWith("http") || doc.ctaHref.startsWith("mailto:");

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main id="main-content">
        <section className="border-b border-border">
          <div className="mx-auto max-w-[1080px] px-4 py-16 sm:px-8 md:py-24">
            <p className="font-mono text-xs uppercase tracking-[0.16em] text-accent-ink">{doc.eyebrow}</p>
            <h1 className="mt-4 text-balance text-4xl font-medium tracking-tight text-foreground md:text-5xl">
              {doc.title}
            </h1>
            <p className="mt-6 max-w-2xl text-lead text-muted-foreground">{doc.lead}</p>
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
        </section>

        <section className="mx-auto max-w-[1080px] space-y-8 px-4 py-16 sm:px-8">
          {doc.sections.map((section) => (
            <CropMarkFrame key={section.heading}>
              <div className="rounded-lg border border-border bg-card p-6 md:p-10">
                <h2 className="text-h3 font-medium text-foreground">{section.heading}</h2>
                {section.body ? <p className="mt-3 text-base text-muted-foreground">{section.body}</p> : null}
                {section.items ? (
                  <ul className="mt-4 space-y-2 text-base text-foreground">
                    {section.items.map((item) => (
                      <li key={item} className="flex gap-2">
                        <span className="font-mono text-accent-ink">→</span>
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
            </CropMarkFrame>
          ))}
        </section>
        <NewCTA />
      </main>
      <Footer />
    </div>
  );
};

export default MarketingPage;
