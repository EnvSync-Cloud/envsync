export type MarketingDoc = {
  path: string;
  eyebrow: string;
  title: string;
  lead: string;
  ctaLabel: string;
  ctaHref: string;
  illustration: string;
  illustrationAlt: string;
  capabilities: { title: string; body: string }[];
  steps: { title: string; body: string }[];
};

export const marketingDocs: MarketingDoc[] = [
  {
    path: "/companies/startups",
    eyebrow: "For startups",
    title: "Stop pasting .env in Slack.",
    lead: "One organization, the CLI, and managed secrets. Ship staging and production without a security hire.",
    ctaLabel: "Start free",
    ctaHref: "/onboarding",
    illustration: "/images/illustrations/startups.png",
    illustrationAlt: "Two developers sharing project keys at a desk",
    capabilities: [
      { title: "Create and pull", body: "A project per app. Environment types for staging and production. envsync pull in CI." },
      { title: "Share without a dump", body: "Invite the team. They get the values they are allowed to see — not a zip of everyone’s keys." },
      { title: "Grow when you need to", body: "Plus+ adds reviews and recovery. Enterprise adds SSO and certificates. Trial a Hosted feature without switching plans." },
    ],
    steps: [
      { title: "Sign up", body: "Hosted Developer: one org, five projects, three members." },
      { title: "Push your first env", body: "CLI or dashboard. Staging and production stay separate." },
      { title: "Hook CI", body: "Same API from GitHub Actions, GitLab, or the SDK." },
    ],
  },
  {
    path: "/companies/msme",
    eyebrow: "For MSME",
    title: "Production changes get a review. Accidents get a rollback.",
    lead: "Plus+ is built for small and mid-size teams: more seats, change requests, point-in-time, and BYOK secrets — without an Enterprise contract.",
    ctaLabel: "Request Plus+",
    ctaHref: "mailto:hello@envsync.cloud?subject=Upgrade%20to%20Plus%2B",
    illustration: "/images/illustrations/msme.png",
    illustrationAlt: "A small team reviewing a config change",
    capabilities: [
      { title: "Protect production", body: "Mark an environment type protected. Promotions wait for a change request." },
      { title: "Recover in minutes", body: "Point-in-time history on secrets and env values. Undo a bad push." },
      { title: "Your key, our workflow", body: "BYOK secrets on Plus+. Self-host OSS includes this workflow for a single org." },
    ],
    steps: [
      { title: "Protect prod", body: "Turn on change requests for the production environment type." },
      { title: "Review in the dashboard", body: "Approvers see the diff. Apply or reject." },
      { title: "Keep shipping", body: "Staging stays fast. Production stays gated." },
    ],
  },
  {
    path: "/companies/enterprise",
    eyebrow: "For Enterprise",
    title: "SSO, certificates, and your own keys — provisioned for you.",
    lead: "Unlimited orgs and seats. OIDC or SAML. Service certificates. Rotation and log forwarding. We turn it on after we talk — not a self-serve upgrade.",
    ctaLabel: "Talk to EnvSync",
    ctaHref: "mailto:hello@envsync.cloud?subject=Enterprise%20plan",
    illustration: "/images/illustrations/enterprise.png",
    illustrationAlt: "A larger team collaborating on identity and secrets",
    capabilities: [
      { title: "One identity model", body: "Members, API keys, service tokens, and workload certificates in the same org." },
      { title: "Your encryption", body: "CMK on AWS, GCP, or Azure. Org CA and leaf keys stay in miniKMS." },
      { title: "Operations you can audit", body: "Rotation, dynamic secrets, log forwarding, long retention." },
    ],
    steps: [
      { title: "Talk to us", body: "We provision Hosted Enterprise or a licensed self-host image." },
      { title: "Connect SSO", body: "OIDC or SAML. Roles map onto OpenFGA." },
      { title: "Issue and rotate", body: "Service certs into projects. Secrets rotate on a schedule." },
    ],
  },
  {
    path: "/product/secrets",
    eyebrow: "Environments & secrets",
    title: "One place for every environment. Promote with a review.",
    lead: "Projects, environment types, CLI and SDK. Pull staging. Push production. The team sees the same values — without a shared .env.",
    ctaLabel: "Start free",
    ctaHref: "/onboarding",
    illustration: "/images/illustrations/secrets.png",
    illustrationAlt: "Keys moving from staging into production",
    capabilities: [
      { title: "Projects and envs", body: "One project per app. Dev, staging, and production as first-class environment types." },
      { title: "CLI and SDK", body: "envsync pull / push. Generated TypeScript and Go clients. Same API as the dashboard." },
      { title: "Webhooks", body: "Know when an environment or secret changes. Route it to Slack, Discord, or your bus." },
    ],
    steps: [
      { title: "Create a project", body: "Add environment types. Protect production if you need a review." },
      { title: "Put values in once", body: "Dashboard or CLI. Encrypted at rest through miniKMS." },
      { title: "Pull at runtime", body: "CI, local, or the SDK. No copy-paste between machines." },
    ],
  },
  {
    path: "/product/certificates",
    eyebrow: "Certificates",
    title: "mTLS for people and services. The key can stay on the box.",
    lead: "Stand up an org CA. Issue a member cert or a service leaf with SANs. Or sign a CSR so the private key never hits EnvSync. Expiry shows up in the list — and in a webhook.",
    ctaLabel: "Start free",
    ctaHref: "/onboarding",
    illustration: "/images/illustrations/certs.png",
    illustrationAlt: "Two services exchanging identity",
    capabilities: [
      { title: "Issue or sign", body: "Managed key once, or bring a CSR. DNS, IP, and SPIFFE URIs." },
      { title: "Stay ahead of expiry", body: "Inventory, warn before 30 days, cert_expiring and cert_expired webhooks." },
      { title: "Renew into secrets", body: "Enterprise auto-renew writes ENVSYNC_TLS_* — or opens a change request if production is protected." },
    ],
    steps: [
      { title: "Initialize the org CA", body: "One intermediate in miniKMS. Download the chain. Copy the CRL URL." },
      { title: "Issue a service cert", body: "Pick the project, common name, SANs. Or paste a CSR." },
      { title: "Wire the workload", body: "CLI, dashboard download, or internal ACME for cert-manager on .internal names." },
    ],
  },
  {
    path: "/product/access",
    eyebrow: "Access & SSO",
    title: "The right people, the right keys, the same org.",
    lead: "Members and roles. API keys and service tokens. Enterprise adds OIDC and SAML so nobody shares a password to the dashboard.",
    ctaLabel: "Start free",
    ctaHref: "/onboarding",
    illustration: "/images/illustrations/access.png",
    illustrationAlt: "A teammate waved through with a badge",
    capabilities: [
      { title: "Roles that stick", body: "View, edit, admin. OpenFGA on every product route." },
      { title: "Machines get tokens", body: "API keys for CI. Service tokens for workloads. Not a human password in Jenkins." },
      { title: "SSO when you’re ready", body: "OIDC or SAML on Enterprise. Keycloak on Hosted and self-host." },
    ],
    steps: [
      { title: "Invite the team", body: "They join the org. Roles apply immediately." },
      { title: "Mint a key for CI", body: "Scope it. Rotate it. Revoke it without touching humans." },
      { title: "Turn on SSO", body: "Map IdP groups to EnvSync roles." },
    ],
  },
  {
    path: "/product/security",
    eyebrow: "Security & operations",
    title: "Reviews before prod. Your keys. A trail you can hand to audit.",
    lead: "Change requests, point-in-time, BYOK and CMK, rotation, dynamic secrets, log forwarding. Plus+ and OSS cover the workflow. Enterprise covers the rest.",
    ctaLabel: "Talk to EnvSync",
    ctaHref: "mailto:hello@envsync.cloud?subject=Security%20and%20operations",
    illustration: "/images/illustrations/security.png",
    illustrationAlt: "Two people approving a change",
    capabilities: [
      { title: "Approve production", body: "Protected environments. Diffs. Apply or reject." },
      { title: "Bring your own key", body: "Plus+ BYOK secrets. Enterprise CMK on AWS, GCP, or Azure." },
      { title: "Rotate and forward", body: "Scheduled rotation, dynamic secrets, logs to your stack." },
    ],
    steps: [
      { title: "Protect the env", body: "Production requires a change request." },
      { title: "Attach your key", body: "BYOK or CMK. miniKMS still does the envelope." },
      { title: "Watch the trail", body: "Audit log, webhooks, optional log forwarding." },
    ],
  },
  {
    path: "/oss",
    eyebrow: "Open source",
    title: "Run the same engine we run. On your cluster.",
    lead: "MIT core: one API, dashboard, CLI, SDKs, miniKMS. One organization. Change requests and recovery included. Enterprise modules stay proprietary — we don’t pretend otherwise.",
    ctaLabel: "View on GitHub",
    ctaHref: "https://github.com/EnvSync-Cloud/envsync",
    illustration: "/images/illustrations/oss.png",
    illustrationAlt: "A team around an open toolbox",
    capabilities: [
      { title: "One process", body: "envsync-api serves product routes. No second management API." },
      { title: "Deploy yourself", body: "Public @envsync-cloud/deploy. Postgres, Redis, miniKMS, Keycloak." },
      { title: "Honest editions", body: "OSS is one org. Hosted signup and SSO are not in the MIT graph." },
    ],
    steps: [
      { title: "Clone and compose", body: "bun install, docker compose, cli init." },
      { title: "Create the first org", body: "Bootstrap via the OSS CLI — not the public landing." },
      { title: "Pull secrets", body: "Same CLI and SDKs as Hosted." },
    ],
  },
  {
    path: "/oss/minikms",
    eyebrow: "miniKMS",
    title: "The engine behind every secret and every cert.",
    lead: "A gRPC service. Envelope encryption, org CAs, member and service certificates. You never log into it — the API does.",
    ctaLabel: "How encryption works",
    ctaHref: "/oss/encryption",
    illustration: "/images/illustrations/minikms.png",
    illustrationAlt: "Sealed envelopes entering and leaving a vault",
    capabilities: [
      { title: "Encrypt and decrypt", body: "Tenant and app scope. Values never sit plaintext in Postgres." },
      { title: "Issue identity", body: "Org intermediate, member certs, SAN leaves, CSR sign, CRL." },
      { title: "Built to replicate", body: "Persisted org CA keys. Shared root CA. Pin ghcr.io/envsync-cloud/minikms." },
    ],
    steps: [
      { title: "Run the image", body: "Compose or Swarm. Session key and root CA material on disk." },
      { title: "Point the API at it", body: "gRPC. Product code never talks PKCS." },
      { title: "Issue and encrypt", body: "Dashboard and CLI keep using /api." },
    ],
  },
  {
    path: "/oss/encryption",
    eyebrow: "Encryption",
    title: "Secrets go in. Ciphertext comes out. Keys stay in the engine.",
    lead: "EnvSync API authenticates you, then asks miniKMS to encrypt. Enterprise can wrap with your CMK. Certificate CA keys never leave miniKMS.",
    ctaLabel: "Open source edition",
    ctaHref: "/oss",
    illustration: "/images/illustrations/minikms.png",
    illustrationAlt: "Sealed envelopes entering and leaving a vault",
    capabilities: [
      { title: "Envelope by default", body: "API → miniKMS. Org and project in the AAD." },
      { title: "Your CMK on top", body: "Enterprise: AWS, GCP, or Azure wrap. Same product API." },
      { title: "Cert keys stay put", body: "Managed leaves return a key once. Org CA private keys stay durable in miniKMS." },
    ],
    steps: [
      { title: "Write a secret", body: "Dashboard or CLI. API encrypts before disk." },
      { title: "Read a secret", body: "Decrypt on the way out. FGA still decides who sees it." },
      { title: "Issue a cert", body: "miniKMS signs. EnvSync stores the inventory." },
    ],
  },
];

export function docByPath(path: string) {
  return marketingDocs.find((doc) => doc.path === path);
}
