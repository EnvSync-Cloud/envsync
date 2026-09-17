import { SectionHeading } from "@/components/primitives/SectionHeading";
import { CropMarkFrame } from "@/components/primitives/CropMarkFrame";

const plans = [
  {
    name: "Developer",
    price: "Free",
    cta: "Start free",
    href: "/onboarding",
    blurb: "Signup and go. One organization, five projects, three members.",
    items: ["Managed secrets", "SDK + CLI", "14-day audit", "Teams and RBAC"],
  },
  {
    name: "Plus+",
    price: "Invoice",
    cta: "Request Plus+",
    href: "mailto:hello@envsync.cloud?subject=Upgrade%20to%20Plus%2B",
    blurb: "Paid upgrade from Developer. Also available on OSS self-host (1 org).",
    items: ["Change requests + recovery", "30 members, 10 API keys", "60-day audit", "BYOK secrets"],
  },
  {
    name: "Enterprise",
    price: "Talk to us",
    cta: "Contact EnvSync",
    href: "mailto:hello@envsync.cloud?subject=Enterprise%20plan",
    blurb: "Provisioned by EnvSync after you contact the team. Not self-serve.",
    items: ["Unlimited orgs and seats", "SSO, rotation, integrations", "Certificates and GPG", "Custom retention"],
  },
];

const PricingPlans = () => {
  return (
    <section className="border-t border-border bg-background bg-grid-box">
      <div className="mx-auto max-w-[1280px] px-4 py-16 sm:px-8 md:py-24">
        <SectionHeading
          align="center"
          eyebrow="PRICING"
          title="Developer, Plus+, Enterprise"
          description="Start free. Upgrade when you need approvals, recovery, and more room."
        />
        <div className="mt-16 grid gap-6 md:grid-cols-3">
          {plans.map((plan) => (
            <CropMarkFrame key={plan.name}>
              <div className="flex h-full flex-col rounded-lg border border-border bg-card p-6">
                <p className="font-mono text-xs uppercase tracking-[0.16em] text-muted-foreground">{plan.name}</p>
                <p className="mt-3 text-2xl font-semibold text-foreground">{plan.price}</p>
                <p className="mt-2 text-sm text-muted-foreground">{plan.blurb}</p>
                <ul className="mt-6 flex-1 space-y-2 text-sm text-foreground">
                  {plan.items.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
                <a
                  href={plan.href}
                  className="mt-6 inline-flex justify-center rounded-lg border border-border px-4 py-2 text-sm font-medium hover:bg-muted"
                >
                  {plan.cta}
                </a>
              </div>
            </CropMarkFrame>
          ))}
        </div>
      </div>
    </section>
  );
};

export default PricingPlans;
