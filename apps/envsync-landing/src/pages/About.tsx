import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { Shield, Users, Target, Award, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";

const About = () => {
  const values = [
    {
      icon: Shield,
      title: "Security First",
      description: "Every decision we make prioritizes the security and privacy of your sensitive data."
    },
    {
      icon: Users,
      title: "Developer Experience",
      description: "We build tools that developers love to use, with intuitive interfaces and powerful features."
    },
    {
      icon: Target,
      title: "Reliability",
      description: "Your applications depend on us, so we've built our infrastructure for maximum reliability."
    },
    {
      icon: Award,
      title: "Innovation",
      description: "We're constantly pushing the boundaries of what's possible in environment management."
    }
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
    }
  ];

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <main className="pt-20 md:pt-24">
        <section className="container mx-auto border-x border-border px-0 py-16 md:py-20">
          <div className="w-full text-center">
            <p className="mb-4 text-xs font-semibold uppercase tracking-[0.16em] text-primary">About</p>
            <h1 className="mb-6 text-5xl font-bold text-foreground md:text-6xl">
              Building secure configuration workflows for modern teams.
            </h1>
            <p className="text-lg text-muted-foreground md:text-xl">
              EnvSync is focused on one thing: make secret and environment management reliable,
              secure, and fast enough for daily shipping.
            </p>
          </div>
        </section>

        <section className="container mx-auto border-x border-t border-border px-0 py-16 md:py-20">
          <div className="grid w-full grid-cols-1 gap-0 md:grid-cols-3">
            <div className="border border-border bg-[hsl(var(--surface-1))] p-6">
              <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Mission</p>
              <p className="mt-3 text-lg font-semibold text-foreground">Secure by default</p>
            </div>
            <div className="-ml-px border border-border bg-[hsl(var(--surface-1))] p-6">
              <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Approach</p>
              <p className="mt-3 text-lg font-semibold text-foreground">Developer-first UX</p>
            </div>
            <div className="-ml-px border border-border bg-[hsl(var(--surface-1))] p-6">
              <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Product</p>
              <p className="mt-3 text-lg font-semibold text-foreground">API + CLI + Dashboard</p>
            </div>
          </div>
        </section>

        <section className="container mx-auto border-x border-t border-border px-0 py-16 md:py-20">
          <div className="w-full border border-border bg-[hsl(var(--surface-1))] p-8 md:p-10">
            <h2 className="mb-5 text-3xl font-bold text-foreground md:text-4xl">Why we built EnvSync</h2>
            <p className="mb-4 text-muted-foreground">
              Traditional configuration handling is fragmented and error-prone at scale. Teams waste
              delivery time on drift, manual updates, and security workarounds instead of product work.
            </p>
            <p className="text-muted-foreground">
              EnvSync unifies configuration operations into one system so engineering teams can ship
              quickly without sacrificing control, auditability, or reliability.
            </p>
          </div>
        </section>

        <section className="container mx-auto border-x border-t border-border px-0 py-16 md:py-20">
          <div className="w-full">
            <h2 className="mb-10 text-center text-3xl font-bold text-foreground md:text-4xl">Core principles</h2>
            <div className="grid grid-cols-1 gap-0 md:grid-cols-2">
              {values.map((value, index) => (
                <div key={index} className="-ml-px -mt-px border border-border bg-[hsl(var(--surface-1))] p-7">
                  <div className="mb-4 flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center border border-border bg-[hsl(var(--surface-2))]">
                      <value.icon className="h-5 w-5 text-primary" />
                    </div>
                    <h3 className="text-xl font-bold text-foreground">{value.title}</h3>
                  </div>
                  <p className="text-muted-foreground">{value.description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="container mx-auto border-x border-t border-border px-0 py-16 md:py-20">
          <div className="w-full">
            <h2 className="mb-10 text-center text-3xl font-bold text-foreground md:text-4xl">Team</h2>
            <div className="grid grid-cols-1 gap-0 md:grid-cols-3">
              {team.map((member, index) => (
                <div key={index} className="-ml-px -mt-px border border-border bg-[hsl(var(--surface-1))] p-7 text-center">
                  <img
                      src={member.profile_image}
                      alt={`${member.name}'s avatar`}
                      className="mx-auto mb-4 h-20 w-20 border border-border object-cover"
                    />
                  <h3 className="mb-1 text-lg font-bold text-foreground">{member.name}</h3>
                  <p className="mb-3 text-sm font-semibold text-primary">{member.role}</p>
                  <p className="text-sm text-muted-foreground">{member.bio}</p>
                  <a
                    href={`https://github.com/${member.github}`}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-4 inline-block text-sm text-muted-foreground hover:text-foreground"
                  >
                    @{member.github}
                  </a>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="container mx-auto border-x border-t border-border px-0 py-16 md:py-20">
          <div className="w-full border border-border bg-[hsl(var(--surface-1))] p-8 text-center md:p-10">
            <h2 className="mb-5 text-4xl font-bold text-foreground">Ready to build with EnvSync?</h2>
            <p className="mb-8 text-lg text-muted-foreground">
              Start with a secure baseline and scale configuration workflows with your team.
            </p>
            <Link to="/onboarding">
              <Button size="lg" className="px-8">
                  Start Free
                  <ArrowRight className="h-4 w-4" />
                </Button>
            </Link>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
};

export default About;
