import { SectionHeading } from "@/components/primitives/SectionHeading";
import { CropMarkFrame } from "@/components/primitives/CropMarkFrame";

const plans = [
  {
    name: "Developer",
    price: "Free",
    priceHint: "One organization. Start in minutes.",
    cta: "Start free",
    href: "/onboarding",
    blurb: "Signup and go. Five projects, three members.",
    items: ["Managed secrets", "SDK + CLI", "14-day audit", "Teams and RBAC"],
  },
  {
    name: "Plus+",
    price: "$18 / month",
    priceHint: "First 5 users. $5 per additional user.",
    cta: "Request Plus+",
    href: "mailto:hello@envsync.cloud?subject=Upgrade%20to%20Plus%2B",
    blurb: "Hosted, billed per member. Self-host OSS includes this workflow set for one org.",
    items: ["Change requests + recovery", "30 members, 10 API keys", "60-day audit", "BYOK secrets"],
  },
  {
    name: "Enterprise",
    price: "Talk to us",
    priceHint: "Unlimited orgs and seats.",
    cta: "Contact EnvSync",
    href: "mailto:hello@envsync.cloud?subject=Enterprise%20plan",
    blurb: "Provisioned by EnvSync after you contact the team. Not self-serve.",
    items: ["SSO, rotation, integrations", "Certificates and GPG", "Custom retention", "Log forwarding"],
  },
];

const comparison = [
  { feature: "Workspaces (orgs)", developer: "1", plus: "3", enterprise: "Unlimited" },
  { feature: "Projects", developer: "5", plus: "Unlimited", enterprise: "Unlimited" },
  { feature: "Variables & environments", developer: "Yes", plus: "Yes", enterprise: "Yes" },
  { feature: "Secrets", developer: "Managed", plus: "Managed + BYOK", enterprise: "Managed + BYOK + CMK" },
  { feature: "Change requests", developer: "—", plus: "Yes", enterprise: "Yes" },
  { feature: "Point in time", developer: "—", plus: "Yes", enterprise: "Yes" },
  { feature: "SSO", developer: "—", plus: "Yes", enterprise: "Yes" },
  { feature: "Audit log", developer: "14 days", plus: "60 days", enterprise: "Custom" },
  { feature: "Integrations", developer: "—", plus: "Yes*", enterprise: "Yes" },
  { feature: "Certificates / GPG", developer: "—", plus: "—", enterprise: "Yes" },
  { feature: "Team members", developer: "3", plus: "30", enterprise: "Unlimited" },
  { feature: "API keys", developer: "2", plus: "10", enterprise: "Unlimited" },
  { feature: "Webhooks", developer: "1", plus: "5", enterprise: "Unlimited" },
  { feature: "Secret rotation", developer: "—", plus: "Yes", enterprise: "Yes" },
  { feature: "SDK + CLI", developer: "Yes", plus: "Yes", enterprise: "Yes" },
];

const PricingPlans = () => {
  return (
    <section id="pricing" className="border-t border-border bg-background bg-grid-box">
      <div className="mx-auto max-w-[1280px] px-4 py-16 sm:px-8 md:py-24">
        <SectionHeading
          align="center"
          eyebrow="PRICING"
          title="Developer, Plus+, Enterprise"
          description="Hosted: start free. Plus+ is $18 / month for the first 5 users, then $5 per additional user. Enterprise is provisioned with us."
        />
        <div className="mt-16 grid gap-6 md:grid-cols-3">
          {plans.map((plan) => (
            <CropMarkFrame key={plan.name}>
              <div className="flex h-full flex-col rounded-lg border border-border bg-card p-6">
                <p className="font-mono text-xs uppercase tracking-[0.16em] text-muted-foreground">{plan.name}</p>
                <p className="mt-3 text-2xl font-semibold text-foreground">{plan.price}</p>
                <p className="mt-1 text-sm text-muted-foreground">{plan.priceHint}</p>
                <p className="mt-3 text-sm text-muted-foreground">{plan.blurb}</p>
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

        <div className="mt-16 overflow-x-auto rounded-lg border border-border">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="border-b border-border bg-card">
              <tr>
                <th className="px-4 py-3 font-medium text-muted-foreground">Feature</th>
                <th className="px-4 py-3 font-medium text-foreground">Developer</th>
                <th className="px-4 py-3 font-medium text-foreground">Plus+</th>
                <th className="px-4 py-3 font-medium text-foreground">Enterprise</th>
              </tr>
            </thead>
            <tbody>
              {comparison.map((row) => (
                <tr key={row.feature} className="border-b border-border last:border-0">
                  <td className="px-4 py-3 text-muted-foreground">{row.feature}</td>
                  <td className="px-4 py-3 text-foreground">{row.developer}</td>
                  <td className="px-4 py-3 text-foreground">{row.plus}</td>
                  <td className="px-4 py-3 text-foreground">{row.enterprise}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="px-4 py-3 text-xs text-muted-foreground">
            * Plus+ integrations exclude AWS, GCP, and Azure cloud KMS destinations.
          </p>
        </div>
      </div>
    </section>
  );
};

export default PricingPlans;
