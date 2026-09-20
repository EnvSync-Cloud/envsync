import { Fragment } from "react";
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

const comparisonGroups = [
  {
    heading: "Workflow",
    rows: [
      { feature: "Workspaces (orgs)", developer: "1", plus: "3", enterprise: "Unlimited" },
      { feature: "Projects", developer: "5", plus: "Unlimited", enterprise: "Unlimited" },
      { feature: "Variables & environments", developer: "Yes", plus: "Yes", enterprise: "Yes" },
      { feature: "Secrets", developer: "Managed", plus: "Managed + BYOK", enterprise: "Managed + BYOK + CMK" },
      { feature: "Change requests", developer: "—", plus: "Yes", enterprise: "Yes" },
      { feature: "Point in time", developer: "—", plus: "Yes", enterprise: "Yes" },
      { feature: "SDK + CLI", developer: "Yes", plus: "Yes", enterprise: "Yes" },
    ],
  },
  {
    heading: "Security",
    rows: [
      { feature: "SSO", developer: "—", plus: "Yes", enterprise: "Yes" },
      { feature: "Certificates / GPG", developer: "—", plus: "—", enterprise: "Yes" },
      { feature: "RBAC", developer: "Yes", plus: "Yes", enterprise: "Yes" },
      { feature: "Audit log", developer: "14 days", plus: "60 days", enterprise: "Custom" },
      { feature: "Secret rotation", developer: "—", plus: "Yes", enterprise: "Yes" },
      { feature: "Gateway", developer: "—", plus: "—", enterprise: "Yes" },
    ],
  },
  {
    heading: "Access",
    rows: [
      { feature: "Teams", developer: "Yes", plus: "Yes", enterprise: "Yes" },
      { feature: "Team members", developer: "3", plus: "30", enterprise: "Unlimited" },
      { feature: "API keys", developer: "2", plus: "10", enterprise: "Unlimited" },
      { feature: "Webhooks", developer: "1", plus: "5", enterprise: "Unlimited" },
      { feature: "Integrations", developer: "—", plus: "Yes*", enterprise: "Yes" },
    ],
  },
];

function PlanValue({ value, featured = false }: { value: string; featured?: boolean }) {
  if (value === "Yes" || value === "Yes*") {
    return (
      <span className="font-mono text-sm text-accent-ink">
        &#10003;{value === "Yes*" ? "*" : ""}
      </span>
    );
  }
  if (value === "—") {
    return <span className="font-mono text-sm text-muted-foreground/60">&mdash;</span>;
  }
  return (
    <span className={`font-mono text-sm ${featured ? "text-foreground" : "text-muted-foreground"}`}>
      {value}
    </span>
  );
}

const PricingPlans = () => {
  return (
    <section id="pricing" className="bg-background bg-grid-box">
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
                <p className="mt-3 text-2xl font-medium tracking-tight text-foreground">{plan.price}</p>
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

        <CropMarkFrame className="mt-16">
          <div className="overflow-x-auto rounded-lg border border-border bg-card">
            <table className="w-full min-w-[720px]">
              <thead>
                <tr className="border-b border-border">
                  <th className="px-6 py-3 text-left font-mono text-mono-label text-muted-foreground">
                    Feature
                  </th>
                  <th className="px-6 py-3 text-center font-mono text-mono-label text-muted-foreground">
                    Developer
                  </th>
                  <th className="bg-accent-surface px-6 py-3 text-center font-mono text-mono-label text-accent-ink">
                    Plus+
                  </th>
                  <th className="px-6 py-3 text-center font-mono text-mono-label text-muted-foreground">
                    Enterprise
                  </th>
                </tr>
              </thead>
              <tbody>
                {comparisonGroups.map((group) => (
                  <Fragment key={group.heading}>
                    <tr className="border-b border-border">
                      <td
                        colSpan={2}
                        className="px-6 py-2 font-mono text-xs uppercase tracking-[0.16em] text-tertiary"
                      >
                        {group.heading}
                      </td>
                      <td className="bg-accent-surface" />
                      <td />
                    </tr>
                    {group.rows.map((row) => (
                      <tr key={row.feature} className="border-b border-border last:border-0">
                        <td className="px-6 py-3.5 text-sm text-foreground">{row.feature}</td>
                        <td className="px-6 py-3.5 text-center">
                          <PlanValue value={row.developer} />
                        </td>
                        <td className="bg-accent-surface px-6 py-3.5 text-center">
                          <PlanValue value={row.plus} featured />
                        </td>
                        <td className="px-6 py-3.5 text-center">
                          <PlanValue value={row.enterprise} />
                        </td>
                      </tr>
                    ))}
                  </Fragment>
                ))}
              </tbody>
            </table>
            <p className="border-t border-border px-6 py-3 text-xs text-muted-foreground">
              * Plus+ integrations exclude AWS, GCP, and Azure cloud KMS destinations.
            </p>
          </div>
        </CropMarkFrame>
      </div>
    </section>
  );
};

export default PricingPlans;
