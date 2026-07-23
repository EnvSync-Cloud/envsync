import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { Button } from "@/components/primitives/Button";
import { Shield, Users, Target, Award, ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";

const About = () => {
  const values = [
    {
      icon: Shield,
      title: "Security First",
      description: "Every decision we make prioritizes the security and privacy of your sensitive data.",
    },
    {
      icon: Users,
      title: "Developer Experience",
      description: "We build tools that developers love to use, with intuitive interfaces and powerful features.",
    },
    {
      icon: Target,
      title: "Reliability",
      description: "Your applications depend on us, so we've built our infrastructure for maximum reliability.",
    },
    {
      icon: Award,
      title: "Innovation",
      description: "We're constantly pushing the boundaries of what's possible in environment management.",
    },
  ];

  const team = [
    {
      name: "Jyotirmoy Bandyopadhayaya",
      role: "Founder",
      github: "BRAVO68WEB",
      profile_image: "https://safe.b68dev.xyz/XH5ClBR3.jpg",
      bio: "A seasoned software engineer with over 4 years of experience in building scalable systems and developer tools.",
    },
    {
      name: "Kostav Mondal",
      role: "Co-Founder",
      github: "XxThunderBlastxX",
      profile_image: "https://safe.b68dev.xyz/24ty6LRi.jpg",
      bio: "Go Developer | Passionate about creating efficient and secure backend systems.",
    },
    {
      name: "Siddharth Biswas",
      role: "Full Stack Developer",
      github: "Atlas2002",
      profile_image: "https://safe.b68dev.xyz/UsJUCLfH.jpg",
      bio: "Full Stack Developer | Experienced in building modern web applications with a focus on user experience.",
    },
  ];

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <main className="pt-16">
        {/* Hero */}
        <section className="border-b border-border bg-background">
          <div className="mx-auto max-w-[1280px] px-4 py-16 sm:px-8 md:py-24 text-left">
            <p className="font-mono text-mono-label uppercase text-accent-ink">About</p>
            <h1 className="mt-4 max-w-3xl text-h1 font-medium text-foreground text-balance">
              Building secure configuration workflows for modern teams.
            </h1>
            <p className="mt-6 max-w-2xl text-lead text-muted-foreground">
              EnvSync is focused on one thing: make secret and environment management reliable,
              secure, and fast enough for daily shipping.
            </p>
          </div>
        </section>

        {/* Mission / Approach / Product strip */}
        <section className="border-b border-border">
          <div className="mx-auto max-w-[1280px] px-4 py-16 sm:px-8">
            <div className="grid gap-px overflow-hidden rounded-lg border border-border bg-border md:grid-cols-3">
              <div className="bg-background p-6">
                <p className="font-mono text-mono-label uppercase text-tertiary">Mission</p>
                <p className="mt-2 text-h3 font-medium text-foreground">Secure by default</p>
              </div>
              <div className="bg-background p-6">
                <p className="font-mono text-mono-label uppercase text-tertiary">Approach</p>
                <p className="mt-2 text-h3 font-medium text-foreground">Developer-first UX</p>
              </div>
              <div className="bg-background p-6">
                <p className="font-mono text-mono-label uppercase text-tertiary">Product</p>
                <p className="mt-2 text-h3 font-medium text-foreground">API + CLI + Dashboard</p>
              </div>
            </div>
          </div>
        </section>

        {/* Why we built EnvSync */}
        <section className="border-b border-border">
          <div className="mx-auto max-w-[1280px] px-4 py-16 sm:px-8">
            <div className="rounded-lg border border-border bg-background p-8 md:p-10">
              <h2 className="text-h2 font-medium text-foreground">Why we built EnvSync</h2>
              <p className="mt-5 text-muted-foreground max-w-3xl">
                Traditional configuration handling is fragmented and error-prone at scale. Teams waste
                delivery time on drift, manual updates, and security workarounds instead of product work.
              </p>
              <p className="mt-4 text-muted-foreground max-w-3xl">
                EnvSync unifies configuration operations into one system so engineering teams can ship
                quickly without sacrificing control, auditability, or reliability.
              </p>
            </div>
          </div>
        </section>

        {/* Core principles */}
        <section className="border-b border-border">
          <div className="mx-auto max-w-[1280px] px-4 py-16 sm:px-8">
            <div className="mb-12">
              <p className="font-mono text-mono-label uppercase text-accent-ink">Principles</p>
              <h2 className="mt-4 text-h1 font-medium text-foreground">Core principles</h2>
              <p className="mt-4 max-w-2xl text-lead text-muted-foreground">
                The operating principles behind every product and security decision.
              </p>
            </div>
            <div className="grid gap-px overflow-hidden rounded-lg border border-border bg-border md:grid-cols-2">
              {values.map((value) => (
                <div key={value.title} className="bg-background p-7">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-md border border-border bg-card">
                      <value.icon className="h-5 w-5 text-foreground" strokeWidth={1.5} />
                    </div>
                    <h3 className="text-h3 font-medium text-foreground">{value.title}</h3>
                  </div>
                  <p className="mt-3 text-sm text-muted-foreground">{value.description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Team */}
        <section className="border-b border-border">
          <div className="mx-auto max-w-[1280px] px-4 py-16 sm:px-8">
            <div className="mb-12">
              <p className="font-mono text-mono-label uppercase text-accent-ink">Team</p>
              <h2 className="mt-4 text-h1 font-medium text-foreground">Team</h2>
              <p className="mt-4 max-w-2xl text-lead text-muted-foreground">
                Engineers focused on secure systems and reliable developer tooling.
              </p>
            </div>
            <div className="grid gap-px overflow-hidden rounded-lg border border-border bg-border md:grid-cols-3">
              {team.map((member) => (
                <div key={member.github} className="bg-background p-7 text-center">
                  <img
                    src={member.profile_image}
                    alt={`${member.name}'s avatar`}
                    className="mx-auto h-20 w-20 rounded-lg border border-border object-cover"
                  />
                  <h3 className="mt-4 text-h3 font-medium text-foreground">{member.name}</h3>
                  <p className="mt-1 font-mono text-mono-label uppercase text-accent-ink">{member.role}</p>
                  <p className="mt-2 text-sm text-muted-foreground">{member.bio}</p>
                  <a
                    href={`https://github.com/${member.github}`}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-4 inline-block font-mono text-sm text-muted-foreground transition-colors hover:text-foreground"
                  >
                    @{member.github}
                  </a>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Bottom CTA */}
        <section className="border-b border-border">
          <div className="mx-auto max-w-[1280px] px-4 py-16 sm:px-8">
            <div className="rounded-lg border border-border bg-card p-8 md:p-10">
              <h2 className="text-h2 font-medium text-foreground">Ready to build with EnvSync?</h2>
              <p className="mt-4 max-w-2xl text-muted-foreground">
                Start with a secure baseline and scale configuration workflows with your team.
              </p>
              <Link to="/onboarding" className="mt-8 inline-block">
                <Button variant="primary" size="lg">
                  Start Free
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
};

export default About;
