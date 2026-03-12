import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useState } from "react";
import { CheckCircle, ArrowRight, Shield, Zap, Users, Loader2, AlertCircle } from "lucide-react";
import { useMutation } from "@tanstack/react-query";
import { api } from "@/helpers/api";

const Onboarding = () => {
  const [email, setEmail] = useState("");

  const createOrgInviteMutation = useMutation({
    mutationFn: (email: string) => api.onboarding.createOrgInvite({ email }),
    onSuccess: (data) => {
      console.log("Organization invite created successfully:", data);
    },
    onError: (error) => {
      console.error("Failed to create organization invite:", error);
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (email && !createOrgInviteMutation.isPending) {
      createOrgInviteMutation.mutate(email);
    }
  };

  const features = [
    {
      icon: Shield,
      title: "Enterprise Security",
      description: "Bank-grade encryption for all your environment variables"
    },
    {
      icon: Zap,
      title: "Lightning Fast",
      description: "Deploy configurations in seconds, not hours"
    },
    {
      icon: Users,
      title: "Team Collaboration",
      description: "Seamless sharing and management across your team"
    }
  ];

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="pt-16" id="onboarding-form">
        <section className="container mx-auto border-x border-border p-0">
          <div className="relative overflow-hidden border border-border bg-[hsl(var(--surface-1))] p-6 text-left md:p-8 md:py-32">
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
              <p className="mb-4 text-xs font-semibold uppercase tracking-[0.16em] text-primary">Onboarding</p>
              <h1 className="mb-5 text-5xl font-bold text-foreground md:text-6xl">
                Start your EnvSync journey
              </h1>
              <p className="max-w-3xl text-lg text-muted-foreground md:text-xl">
                Join teams using EnvSync to manage environment variables with secure, repeatable workflows.
              </p>
            </div>
          </div>
        </section>

        <section className="container mx-auto border-x border-t border-border p-0">
          <div className="w-full border border-border bg-[hsl(var(--surface-1))] ">
            <div className="grid grid-cols-1 gap-0 lg:grid-cols-[minmax(0,560px)_minmax(0,1fr)]">
              <div className="border border-border bg-[hsl(var(--surface-2))] p-6 md:p-8">
                {!createOrgInviteMutation.isSuccess ? (
                  <div>
                    <div className="mb-6">
                      <h2 className="text-2xl font-semibold text-foreground">Get Started</h2>
                      <p className="mt-2 text-muted-foreground">
                        Enter your email to begin your journey with EnvSync
                      </p>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-4">
                      <div>
                        <Label htmlFor="email" className="text-muted-foreground">Email Address</Label>
                        <Input
                          id="email"
                          type="email"
                          placeholder="you@company.com"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          required
                          disabled={createOrgInviteMutation.isPending}
                          className="mt-2 h-10 rounded-none border-border bg-background text-foreground placeholder:text-muted-foreground focus-visible:ring-primary disabled:opacity-50"
                        />
                      </div>

                      {createOrgInviteMutation.isError && (
                        <div className="flex items-center gap-2 border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-300">
                          <AlertCircle className="h-4 w-4 shrink-0" />
                          <span>
                            {createOrgInviteMutation.error instanceof Error
                              ? createOrgInviteMutation.error.message
                              : "Something went wrong. Please try again."}
                          </span>
                        </div>
                      )}

                      <Button
                        type="submit"
                        className="w-full disabled:cursor-not-allowed"
                        size="lg"
                        disabled={createOrgInviteMutation.isPending || !email}
                      >
                        {createOrgInviteMutation.isPending ? (
                          <>
                            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                            Creating Invite...
                          </>
                        ) : (
                          <>
                            Get Started
                            <ArrowRight className="h-5 w-5" />
                          </>
                        )}
                      </Button>

                      <p className="mt-3 text-sm text-muted-foreground">
                        No setup fees • Start immediately
                      </p>
                    </form>
                  </div>
                ) : (
                  <div>
                    <div className="mb-4 flex items-center gap-2">
                      <CheckCircle className="h-6 w-6 text-primary" />
                      <h3 className="text-2xl font-bold text-foreground">Welcome to EnvSync!</h3>
                    </div>
                    <p className="mb-6 text-muted-foreground">
                      We have sent you an email at <span className="text-primary">{email}</span> with your next steps.
                    </p>
                    <div className="flex flex-col gap-3 sm:flex-row">
                      <Button
                        onClick={() => window.open("mailto:", "_blank")}
                      >
                        Check Your Email
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => {
                          setEmail("");
                          createOrgInviteMutation.reset();
                        }}
                      >
                        Submit Another Email
                      </Button>
                    </div>
                  </div>
                )}
              </div>

              <div className="-mt-px border border-border bg-[hsl(var(--surface-1))] p-6 lg:-mt-0 lg:-ml-px md:p-8">
                <p className="mb-3 text-xs font-semibold uppercase tracking-[0.16em] text-primary">What happens next</p>
                <div className="space-y-3 text-sm md:text-base">
                  <div className="border border-border bg-[hsl(var(--surface-2))] p-3 text-muted-foreground">
                    1. Receive your onboarding invite via email.
                  </div>
                  <div className="border border-border bg-[hsl(var(--surface-2))] p-3 text-muted-foreground">
                    2. Create your organization and first project.
                  </div>
                  <div className="border border-border bg-[hsl(var(--surface-2))] p-3 text-muted-foreground">
                    3. Sync your first environment using the CLI.
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="container mx-auto border-x border-t border-border p-0">
          <div className="relative overflow-hidden border border-border bg-[hsl(var(--surface-1))] p-6 text-left md:p-8">
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
              <h2 className="mb-4 text-4xl font-bold text-foreground md:text-5xl">Why choose EnvSync?</h2>
              <p className="max-w-2xl text-lg text-muted-foreground md:text-xl">
                Everything you need to manage environment variables at scale.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-0 md:grid-cols-3">
            {features.map((feature, index) => (
              <div key={index} className="-ml-px -mt-px border border-border bg-[hsl(var(--surface-1))] p-7 text-left">
                <div className="mb-4 flex h-12 w-12 items-center justify-center border border-border bg-[hsl(var(--surface-2))]">
                  <feature.icon className="h-6 w-6 text-primary" />
                </div>
                <h3 className="mb-3 text-xl font-bold text-foreground">{feature.title}</h3>
                <p className="text-muted-foreground">{feature.description}</p>
              </div>
            ))}
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
};

export default Onboarding;
