export type MarketingDoc = {
  path: string;
  eyebrow: string;
  title: string;
  lead: string;
  ctaLabel: string;
  ctaHref: string;
  sections: { heading: string; body?: string; items?: string[] }[];
};

export const marketingDocs: MarketingDoc[] = [
  {
    path: "/companies/startups",
    eyebrow: "Companies · Startups",
    title: "Ship config without a security team.",
    lead: "EnvSync on the Developer plan is one organization, CLI and SDK, and managed secrets. You are not buying a PKI suite — you are stopping .env files in Slack.",
    ctaLabel: "Start free",
    ctaHref: "/onboarding",
    sections: [
      {
        heading: "How you use it",
        body: "Create the org from Hosted signup, add a project per app, put staging and production in environment types, pull with the CLI in CI.",
        items: [
          "One org, five projects, three members on Developer",
          "Managed secrets — no BYOK required to start",
          "SDK and CLI against the same API",
          "Hosted overlay can trial a feature without changing plan",
        ],
      },
      {
        heading: "When you outgrow it",
        body: "Change requests, point-in-time recovery, and BYOK live on Plus+. Certificates, SSO, and rotation are Enterprise — or a Hosted overlay if we turn them on for a trial.",
      },
    ],
  },
  {
    path: "/companies/msme",
    eyebrow: "Companies · MSME",
    title: "Approvals and recovery without an Enterprise contract.",
    lead: "For small and mid-size teams the product is Plus+: more seats, change requests, point-in-time, BYOK secrets. The plan name stays Plus+. MSME is who it is for.",
    ctaLabel: "Request Plus+",
    ctaHref: "mailto:hello@envsync.cloud?subject=Upgrade%20to%20Plus%2B",
    sections: [
      {
        heading: "How you use it",
        body: "Production env types are protected. Promotions go through change requests. Audit retention is 60 days. Secrets can use your key.",
        items: [
          "Change requests and recovery on Hosted Plus+",
          "Self-host OSS includes this workflow set for one org, no license",
          "30 members, 10 API keys, 5 webhooks",
          "SSO and rotation stay on Enterprise unless overlayed",
        ],
      },
    ],
  },
  {
    path: "/companies/enterprise",
    eyebrow: "Companies · Enterprise",
    title: "Provisioned identity, certs, and encryption — not self-serve.",
    lead: "Enterprise is turned on by EnvSync after you talk to us. Unlimited orgs and seats, SSO, rotation, certificates, GPG, log forwarding. Not a Developer upgrade button.",
    ctaLabel: "Contact EnvSync",
    ctaHref: "mailto:hello@envsync.cloud?subject=Enterprise%20plan",
    sections: [
      {
        heading: "How you use it",
        body: "We provision the org. You connect OIDC or SAML, issue service certificates into projects, rotate secrets, forward logs. Overlay can preview a module before the contract.",
        items: [
          "SSO (OIDC/SAML), rotation, dynamic secrets",
          "Certificates: org CA, member and service leaves, CSR, internal ACME",
          "CMK / BYOK, audit, log forwarding",
          "Hosted or self-host Enterprise image — not OSS pretending to be EE",
        ],
      },
    ],
  },
  {
    path: "/product/secrets",
    eyebrow: "Product · Secrets",
    title: "Environments and secrets, one API.",
    lead: "Projects, environment types, promotion, CLI and SDK. This is the core product on Hosted and on self-host OSS.",
    ctaLabel: "Get started",
    ctaHref: "/onboarding",
    sections: [
      {
        heading: "What you get",
        items: [
          "Projects scoped to an organization",
          "Environment types (dev / staging / production) with protection",
          "CLI pull/push and generated TS/Go SDKs",
          "Webhooks on env and secret events",
        ],
      },
      {
        heading: "What this is not",
        body: "Not a second HashiCorp Vault UI. Values are encrypted through miniKMS. Change requests and point-in-time are Plus+ / OSS workflow, not Developer Hosted.",
      },
    ],
  },
  {
    path: "/product/certificates",
    eyebrow: "Product · Certificates",
    title: "Identity certs for people and workloads.",
    lead: "Org intermediate CA in miniKMS. Member certs, project leaves with SANs, CSR so the key never hits EnvSync, expiry webhooks, auto-renew into ENVSYNC_TLS_*. Internal ACME for .internal — not Let’s Encrypt.",
    ctaLabel: "See OSS encryption",
    ctaHref: "/oss/encryption",
    sections: [
      {
        heading: "Shipped",
        items: [
          "Inventory with expiry and CRL URL",
          "Issue leaf (managed key once) or sign a CSR",
          "cert_expiring / cert_expired webhooks",
          "Enterprise auto-renew into project secrets or a change request",
        ],
      },
      {
        heading: "Out of this product",
        body: "No public CAs, EST/SCEP, discovery scanners, or Venafi. Certificates stay on the same identity line as API keys and service tokens.",
      },
    ],
  },
  {
    path: "/product/access",
    eyebrow: "Product · Access",
    title: "Who can read secrets — and how they prove it.",
    lead: "Members, RBAC, API keys, service tokens. Enterprise adds OIDC and SAML. Org create on Hosted is POST /auth/create-organization only.",
    ctaLabel: "Get started",
    ctaHref: "/onboarding",
    sections: [
      {
        heading: "Core",
        items: ["Organization members and roles", "API keys", "Service tokens", "OpenFGA checks on every product route"],
      },
      {
        heading: "Enterprise",
        items: ["OIDC", "SAML", "Keycloak theme on Hosted and self-host"],
      },
    ],
  },
  {
    path: "/product/security",
    eyebrow: "Product · Security",
    title: "Approvals, keys, and an audit trail.",
    lead: "Change requests, audit, BYOK/CMK, rotation, dynamic secrets, log forwarding. Most of this is Plus+ or Enterprise — OSS self-host already includes the Plus+ workflow set for one org.",
    ctaLabel: "Contact EnvSync",
    ctaHref: "mailto:hello@envsync.cloud?subject=Security%20and%20Enterprise",
    sections: [
      {
        heading: "Operations",
        items: [
          "Change requests on protected environments",
          "Point-in-time recovery",
          "Audit log + webhooks",
          "Secret rotation and dynamic secrets (Enterprise)",
          "Log forwarding (Enterprise)",
          "CMK: AWS / GCP / Azure (Enterprise)",
        ],
      },
    ],
  },
  {
    path: "/oss",
    eyebrow: "OSS",
    title: "Dual license. One API process. No fake Enterprise.",
    lead: "The public monorepo is MIT core plus proprietary EE packages. Self-host OSS is @envsync-cloud/deploy, one org, dashboard shell. EE modules do not load. Plus+ workflow features (change requests, PIT, BYOK secrets) are included for that single org.",
    ctaLabel: "GitHub",
    ctaHref: "https://github.com/EnvSync-Cloud/envsync",
    sections: [
      {
        heading: "What OSS is",
        items: [
          "envsync-api, envsync-web shell, CLI, TS/Go SDKs",
          "miniKMS for encryption and org CA",
          "Single org — no self-serve org create on the landing",
          "Deploy with the public OSS CLI",
        ],
      },
      {
        heading: "What OSS is not",
        body: "Not Hosted signup. Not /api/v1/manage. Not SSO, rotation, certificates overlay, or log forwarding unless you run the Enterprise image with a license.",
      },
    ],
  },
  {
    path: "/oss/minikms",
    eyebrow: "OSS · Engine",
    title: "miniKMS is the encryption and PKI engine.",
    lead: "A gRPC service, not a dashboard. EnvSync API talks to it for envelope encryption, org intermediate CAs, member and leaf certificates. Image ghcr.io/envsync-cloud/minikms. Keys do not live in Postgres as plaintext.",
    ctaLabel: "Encryption path",
    ctaHref: "/oss/encryption",
    sections: [
      {
        heading: "What it does",
        items: [
          "Tenant-scoped encrypt/decrypt",
          "Org CA issue (members, service leaves, CSR sign)",
          "CRL / OCSP",
          "HA: persisted org CA keys, shared root CA material",
        ],
      },
      {
        heading: "What it is not",
        body: "Not a HashiCorp Vault replacement UI. Not Let’s Encrypt. Operators do not log into miniKMS — the API is the product.",
      },
    ],
  },
  {
    path: "/oss/encryption",
    eyebrow: "OSS · Encryption",
    title: "How EnvSync uses miniKMS.",
    lead: "The API never stores raw secret values. Encrypt and decrypt go through miniKMS with org and app scope. Enterprise can wrap with a customer CMK. Certificate private keys for managed leaves are returned once; CA keys stay in miniKMS.",
    ctaLabel: "Read the OSS edition",
    ctaHref: "/oss",
    sections: [
      {
        heading: "Path",
        items: [
          "Client → envsync-api (auth, FGA, plan flags)",
          "API → miniKMS gRPC (encrypt / decrypt / PKI)",
          "Optional Enterprise CMK (AWS KMS, GCP, Azure) for org wrapping",
          "Vault entries can be wrapped to the org CA for member recovery",
        ],
      },
      {
        heading: "Operators",
        body: "Self-host: pin the miniKMS image, mount a session signing key and root CA material, run SQL migrations 001–007. Hosted runs the same engine.",
      },
    ],
  },
];

export function docByPath(path: string) {
  return marketingDocs.find((doc) => doc.path === path);
}
