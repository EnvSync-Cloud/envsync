import { useEffect, useRef, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import {
  Check,
  GitPullRequest,
  History,
  KeyRound,
  Lock,
  ScrollText,
  ShieldCheck,
  Terminal,
} from "lucide-react";
import { trackAction } from "@/telemetry";
import { runtimeConfig } from "@/utils/runtime-config";
import "./home.css";

const green = "#1dc379";
const deep = "#0f7a45";
const card = "hsl(var(--card))";
const line = "hsl(var(--border))";
const muted = "hsl(var(--muted-foreground))";
const accent = "hsl(var(--accent-ink))";
const wash = "hsl(153 74% 44% / 0.14)";

function useInView<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [on, setOn] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setOn(true);
          io.disconnect();
        }
      },
      { threshold: 0.2 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return [ref, on] as const;
}

function Corners({ live = false, onGreen = false }: { live?: boolean; onGreen?: boolean }) {
  const cls = `corner-mark${live ? " corner-live" : ""}${onGreen ? " on-green" : ""}`;
  return (
    <>
      <span className={`${cls} -left-[5px] -top-[5px] border-l border-t`} data-motion="corner" />
      <span className={`${cls} -right-[5px] -top-[5px] border-r border-t`} />
      <span className={`${cls} -bottom-[5px] -left-[5px] border-b border-l`} />
      <span className={`${cls} -bottom-[5px] -right-[5px] border-b border-r`} />
    </>
  );
}

function CodeMark({ className = "h-5 w-8" }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 24" className={className} aria-hidden="true">
      <path className="code-left" d="M16 4 L8 12 L16 20" fill="none" stroke={green} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" data-motion="code-left" />
      <path className="code-center" d="M22 20 L28 4" fill="none" stroke={green} strokeWidth="1.6" strokeLinecap="round" data-motion="code-center" />
      <path className="code-right" d="M32 4 L40 12 L32 20" fill="none" stroke={green} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" data-motion="code-right" />
    </svg>
  );
}

function Overhead() {
  return (
    <svg viewBox="0 0 24 24" className="h-6 w-6" aria-hidden="true">
      <path
        className="spin-mark"
        d="M19 12a7 7 0 0 1-11.5 5.3M5 12a7 7 0 0 1 11.5-5.3M16 4.5V8h3.5M8 19.5V16H4.5"
        fill="none"
        stroke={green}
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
        data-motion="spin-mark"
      />
    </svg>
  );
}

const titleClass =
  "text-balance text-center text-[32px] font-medium leading-[1.05] tracking-[-1.1px] text-foreground md:text-[48px] md:tracking-[-1.4px]";

const benefits = [
  {
    icon: Terminal,
    title: "One pull, every machine",
    body: "The CLI and the SDK read the same values. Nothing to paste into Slack.",
  },
  {
    icon: ShieldCheck,
    title: "Production waits",
    body: "A protected environment takes a change request. Staging can stay open.",
  },
  {
    icon: Lock,
    title: "Encrypted in transit and at rest",
    body: "miniKMS holds the keys. The dashboard is the workflow, not a second store.",
  },
  {
    icon: GitPullRequest,
    title: "A diff, then apply",
    body: "Approvers see what changed. Reject it, or apply it.",
  },
  {
    icon: History,
    title: "Recovery on Plus+",
    body: "Point-in-time history on secrets and env values. Undo a bad push.",
  },
  {
    icon: ScrollText,
    title: "An audit you can hand over",
    body: "Developer keeps 14 days. Plus+ keeps 60. Enterprise retention is custom.",
  },
];

const snippets = [
  {
    id: "pull",
    lines: ["$ envsync pull --env staging", "Synced 12 values from staging"],
  },
  {
    id: "push",
    lines: ["$ envsync push --env production --strict", "Approval required before prod sync"],
  },
  {
    id: "approve",
    lines: ["$ envsync request approve --id cr_abc123", "Approved and applied to production"],
  },
];

const notes = [
  {
    title: "Change requests",
    body: "Protected production waits for a diff. Apply it, or reject it.",
    accent: true,
  },
  {
    title: "Point in time",
    body: "Roll a secret or a whole environment back to an earlier push.",
  },
  {
    title: "Certificates",
    body: "Issue a service leaf, or sign a CSR so the private key stays on the box.",
  },
];

type ShipStatus = "Synced" | "In review" | "Queued";

const shipSteps: { id: string; env: string; when: string; status: ShipStatus; dim?: boolean }[][] = [
  [
    { id: "cr_1042", env: "staging", when: "2m ago", status: "Synced" },
    { id: "cr_1041", env: "production", when: "4m ago", status: "In review" },
    { id: "cr_1040", env: "production", when: "6m ago", status: "Queued", dim: true },
  ],
  [
    { id: "cr_1042", env: "staging", when: "2m ago", status: "Synced" },
    { id: "cr_1041", env: "production", when: "4m ago", status: "Synced" },
    { id: "cr_1040", env: "production", when: "6m ago", status: "In review" },
  ],
  [
    { id: "cr_1043", env: "production", when: "just now", status: "Queued" },
    { id: "cr_1042", env: "staging", when: "2m ago", status: "Synced" },
    { id: "cr_1041", env: "production", when: "4m ago", status: "Synced" },
  ],
];

const priceRows = [
  ["Projects", "5", "Unlimited", "Unlimited"],
  ["Members", "3", "30", "Unlimited"],
  ["Change requests", "—", "Yes", "Yes"],
  ["Audit log", "14 days", "60 days", "Custom"],
];

const directory = [
  {
    label: "Secrets",
    items: [
      ["Environments", "/product/secrets"],
      ["CLI and SDK", "/product/secrets"],
      ["Change requests", "/product/security"],
      ["Webhooks", "/integrations"],
    ],
  },
  {
    label: "Access",
    items: [
      ["Members and roles", "/product/access"],
      ["API keys", "/product/access"],
      ["SSO", "/product/access"],
      ["Certificates", "/product/certificates"],
    ],
  },
  {
    label: "Operations",
    items: [
      ["Rotation", "/product/security"],
      ["Point in time", "/product/security"],
      ["Audit log", "/product/security"],
      ["miniKMS", "/oss/minikms"],
      ["Encryption", "/oss/encryption"],
    ],
  },
] as const;

const ticker = [
  "Change requests before production",
  "Encrypted at rest and in transit",
  "CLI and SDK on the same API",
  "Point-in-time recovery on Plus+",
  "Certificates on Enterprise",
];

function Pill({
  href,
  children,
  kind,
  onClick,
}: {
  href: string;
  children: ReactNode;
  kind: "fill" | "ghost" | "light" | "light-ghost";
  onClick?: () => void;
}) {
  const cls =
    kind === "fill"
      ? "bg-primary text-primary-foreground hover:opacity-90"
      : kind === "ghost"
        ? "border border-border bg-transparent text-foreground hover:bg-card"
        : kind === "light"
          ? "bg-white text-[#14241b] hover:bg-white/90"
          : "border border-white/70 bg-transparent text-white hover:bg-white/10";
  const className = `inline-flex h-11 items-center justify-center rounded-full px-5 text-[15px] font-medium transition-opacity duration-150 ${cls}`;
  if (href.startsWith("/")) {
    return (
      <Link to={href} className={className} onClick={onClick}>
        {children}
      </Link>
    );
  }
  return (
    <a href={href} className={className} onClick={onClick} target="_blank" rel="noopener noreferrer">
      {children}
    </a>
  );
}

function SvgCodeMark({ x, y }: { x: number; y: number }) {
  const pen = { fill: "none", stroke: green, strokeWidth: 1.7, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  return (
    <g transform={`translate(${x} ${y})`}>
      <path className="code-left" d="M16 2 L6 12 L16 22" {...pen} data-motion="code-left" />
      <path className="code-center" d="M20 22 L28 2" {...pen} data-motion="code-center" />
      <path className="code-right" d="M32 2 L42 12 L32 22" {...pen} data-motion="code-right" />
    </g>
  );
}

function HeroDiagram({ late = false }: { late?: boolean }) {
  const cards = [
    { name: "dev", x: 408 },
    { name: "staging", x: 500 },
    { name: "prod", x: 592 },
  ];
  return (
    <div id="home-lines" className={`${late ? "canvas-fade-late" : "home-fade"} mx-auto w-full max-w-[1080px]`} data-motion="hero-lines">
      <svg viewBox="0 0 1080 210" className="hidden h-auto w-full sm:block" role="img" aria-label="envsync pull flows into dev, staging, and prod, then to approve">
        <path className="dash" d="M184 120 C 250 48, 324 48, 392 120" fill="none" stroke={green} strokeWidth="1.5" />
        <path className="dash" d="M688 120 C 756 48, 830 48, 896 120" fill="none" stroke={green} strokeWidth="1.5" />

        <rect x="28" y="96" width="156" height="48" rx="8" fill={card} stroke={line} />
        <text x="106" y="125" textAnchor="middle" fill={muted} fontSize="13" fontFamily="Inter, ui-sans-serif, system-ui, sans-serif">
          envsync pull
        </text>

        <rect x="896" y="96" width="156" height="48" rx="8" fill={card} stroke={line} />
        <text x="974" y="125" textAnchor="middle" fill={muted} fontSize="13" fontFamily="Inter, ui-sans-serif, system-ui, sans-serif">
          approve
        </text>

        <g className="cluster-in" data-motion="hero-cluster">
          <text x="540" y="40" textAnchor="middle" fill={accent} fontSize="14" fontFamily="Inter, ui-sans-serif, system-ui, sans-serif">
            Environments
          </text>
          <rect x="392" y="56" width="296" height="128" rx="10" fill={card} stroke="hsl(153 74% 44% / 0.45)" />
          <path d="M392 56 H402 M392 56 V66" fill="none" stroke="hsl(0 0% 38%)" strokeWidth="1" />
          <path d="M688 56 H678 M688 56 V66" fill="none" stroke="hsl(0 0% 38%)" strokeWidth="1" />
          <path d="M392 184 H402 M392 184 V174" fill="none" stroke="hsl(0 0% 38%)" strokeWidth="1" />
          <path d="M688 184 H678 M688 184 V174" fill="none" stroke="hsl(0 0% 38%)" strokeWidth="1" />
          {cards.map((cardBox) => (
            <g key={cardBox.name}>
              <rect x={cardBox.x} y="78" width="80" height="86" rx="8" fill={wash} stroke="hsl(153 74% 44% / 0.4)" strokeDasharray="3 3" />
              <SvgCodeMark x={cardBox.x + 16} y={92} />
              <text x={cardBox.x + 40} y="150" textAnchor="middle" fill={accent} fontSize="12" fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace">
                {cardBox.name}
              </text>
            </g>
          ))}
        </g>
      </svg>

      <div className="cluster-in flex justify-center sm:hidden" data-motion="hero-cluster">
        <div>
          <p className="mb-2 text-center text-[13px] text-accent-ink">Environments</p>
          <div className="flex gap-2 rounded-md border border-[hsl(153_74%_44%/0.45)] bg-card px-3 py-3">
            {cards.map((cardBox) => (
              <div key={cardBox.name} className="flex w-[72px] flex-col items-center gap-1 rounded-md border border-dashed border-[hsl(153_74%_44%/0.4)] bg-[hsl(153_74%_44%/0.14)] px-2 py-2">
                <CodeMark />
                <span className="font-mono text-[11px] text-accent-ink">{cardBox.name}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function CompareDiagram() {
  const delays = [700, 750, 800, 900, 1000];
  return (
    <div className="mt-12 grid items-center gap-8 lg:grid-cols-[1fr_auto]">
      <div className="relative mx-auto flex w-full max-w-[760px] flex-wrap items-end justify-center gap-8 px-4 py-10">
        <Corners />
        <div className="flex flex-col items-center gap-3">
          <div className="grid grid-cols-2 gap-2">
            {delays.slice(0, 4).map((d, i) => (
              <div
                key={d}
                className="tile-in flex h-[72px] w-[72px] flex-col items-center justify-center gap-1 rounded-md border border-dashed border-[hsl(153_74%_44%/0.4)] bg-[hsl(153_74%_44%/0.1)]"
                style={{ ["--d" as string]: `${d}ms` }}
              >
                <CodeMark className="h-4 w-7" />
                {i % 2 === 0 ? <Overhead /> : null}
              </div>
            ))}
          </div>
          <p className="text-center text-[13px] text-accent-ink">
            Pasted .env
          </p>
        </div>
        <div className="flex flex-col items-center gap-3">
          <div className="relative rounded-md border border-dashed border-[hsl(153_74%_44%/0.4)] bg-[hsl(153_74%_44%/0.08)] p-2">
            <div className="grid grid-cols-3 gap-1.5">
              {Array.from({ length: 9 }, (_, i) => (
                <div
                  key={i}
                  className="tile-in flex h-11 w-11 items-center justify-center rounded border border-dashed border-[hsl(153_74%_44%/0.4)] bg-card"
                  style={{ ["--d" as string]: `${delays[Math.min(i, delays.length - 1)]}ms` }}
                >
                  <CodeMark className="h-3.5 w-6" />
                </div>
              ))}
            </div>
            <div className="tile-in absolute -right-3 bottom-2 rounded-full bg-card p-1" style={{ ["--d" as string]: "1000ms" }}>
              <Overhead />
            </div>
          </div>
          <p className="text-center text-[13px] text-accent-ink">EnvSync</p>
        </div>
      </div>
      <ul className="space-y-3 text-[13px] text-accent-ink">
        <li className="flex items-center gap-2">
          <CodeMark className="h-4 w-7" /> Value
        </li>
        <li className="flex items-center gap-2">
          <Overhead /> Copy step
        </li>
      </ul>
    </div>
  );
}

function UseArt({ kind }: { kind: 0 | 1 | 2 | 3 }) {
  if (kind === 0) {
    return (
      <svg viewBox="0 0 320 140" className="h-full w-full" aria-hidden="true">
        <path className="dash" d="M40 70 H120" stroke={green} strokeWidth="1.2" />
        <path className="dash" d="M200 70 H280" stroke={green} strokeWidth="1.2" />
        <rect x="120" y="48" width="80" height="44" rx="6" fill="none" stroke={green} />
        <text x="160" y="75" textAnchor="middle" fontSize="12" fill={green}>pull</text>
        <rect x="16" y="52" width="28" height="36" rx="3" fill="none" stroke={line} />
        <rect x="276" y="40" width="36" height="28" rx="3" fill="none" stroke={line} />
      </svg>
    );
  }
  if (kind === 1) {
    return (
      <svg viewBox="0 0 320 140" className="h-full w-full" aria-hidden="true">
        <rect x="36" y="36" width="160" height="18" rx="3" fill="hsl(var(--muted))" />
        <rect x="36" y="62" width="120" height="18" rx="3" fill="hsl(var(--muted))" />
        <rect x="170" y="78" width="120" height="36" rx="8" fill={green} />
        <text x="230" y="101" textAnchor="middle" fontSize="12" fill="#14241b">approve</text>
      </svg>
    );
  }
  if (kind === 2) {
    return (
      <svg viewBox="0 0 320 140" className="h-full w-full" aria-hidden="true">
        {[70, 150, 230].map((x) => (
          <g key={x}>
            <rect x={x - 22} y="40" width="44" height="52" rx="6" fill="none" stroke={green} />
            <path d={`M${x - 10} 62 H${x + 10} M${x - 10} 74 H${x + 10}`} stroke={green} strokeWidth="1.4" />
          </g>
        ))}
        <path className="dash" d="M48 100 H272" stroke={green} strokeWidth="1" opacity="0.6" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 320 140" className="h-full w-full" aria-hidden="true">
      <circle cx="70" cy="70" r="22" fill="none" stroke={green} />
      <path className="spin-mark" d="M70 54 v8 M70 78 v8 M54 70 h8 M78 70 h8" stroke={green} strokeWidth="1.4" strokeLinecap="round" />
      <path className="dash" d="M100 70 H180" stroke={green} />
      <rect x="180" y="48" width="100" height="44" rx="6" fill="none" stroke={line} />
      <text x="230" y="75" textAnchor="middle" fontSize="12" fill={muted}>rollback</text>
    </svg>
  );
}

function ShipList() {
  const ref = useRef<HTMLElement>(null);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const onScroll = () => {
      const el = ref.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const total = rect.height + window.innerHeight;
      const seen = window.innerHeight - rect.top;
      setProgress(Math.min(1, Math.max(0, seen / total)));
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const step = progress < 0.45 ? 0 : progress < 0.8 ? 1 : 2;
  const shift = step === 2 ? ((progress - 0.8) / 0.2) * 52 : 0;
  const rows = shipSteps[step];

  return (
    <section ref={ref} className="mx-auto max-w-[720px] px-6 py-20 text-center" data-motion="ship" data-step={step}>
      <h2 className={titleClass}>Ship now, or wait</h2>
      <p className="mx-auto mt-4 max-w-[560px] text-[16px] leading-7 text-muted-foreground">
        Staging applies on push. Production stays queued until the change request is approved. If the diff is wrong, reject it.
      </p>
      <div className="relative mt-10 h-[188px] overflow-hidden text-left">
        <div
          className="flex flex-col gap-2"
          style={{ transform: `translateY(${8 - shift}px)` }}
        >
          {rows.map((row) => (
            <div
              key={row.id + row.status}
              className="flex items-center gap-3 rounded-md bg-[hsl(153_74%_44%/0.12)] px-4 py-3 text-[13px]"
              style={{ opacity: row.dim ? 0.35 : 1 }}
            >
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded bg-background">
                {row.status === "In review" ? (
                  <span className="status-spin block h-3.5 w-3.5 rounded-full border border-[#1dc379] border-t-transparent" data-motion="status-spin" />
                ) : row.status === "Synced" ? (
                  <Check className="h-3.5 w-3.5 text-accent-ink" />
                ) : (
                  <span className="h-2 w-2 rounded-full border border-[#1dc379]" />
                )}
              </span>
              <span className="font-mono text-accent-ink">{row.id}</span>
              <span className="text-accent-ink/80">{row.env} · {row.when}</span>
              <span className="ml-auto text-accent-ink">{row.status}</span>
            </div>
          ))}
        </div>
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-12 bg-gradient-to-b from-transparent to-background" />
      </div>
    </section>
  );
}

export default function HomeLanding() {
  const [benefitsRef, benefitsIn] = useInView<HTMLElement>();
  const [compareRef, compareIn] = useInView<HTMLElement>();
  const [usesRef, usesIn] = useInView<HTMLElement>();
  const [platformRef, platformIn] = useInView<HTMLElement>();
  const [priceRef, priceIn] = useInView<HTMLElement>();
  const [dirRef, dirIn] = useInView<HTMLElement>();
  const [closeRef, closeIn] = useInView<HTMLElement>();
  const [snippet, setSnippet] = useState(0);
  const [copied, setCopied] = useState(false);

  const command = "envsync pull --env staging";

  const noise = [
    "pasted the .env in chat",
    "staging and prod drifted",
    "who changed DATABASE_URL?",
    "the file in the repo is old",
  ];

  return (
    <>
      <section className="px-3 pt-3 md:px-4" data-motion="home-hero">
        <div
          className="canvas-fade relative flex min-h-[560px] items-center justify-center overflow-hidden rounded-2xl px-6 py-20 text-center md:min-h-[640px]"
          style={{ background: deep }}
          data-motion="canvas-fade"
        >
          <div
            className="pointer-events-none absolute inset-0 opacity-50"
            style={{
              backgroundImage: "radial-gradient(rgba(255,255,255,0.55) 0.7px, transparent 0.75px)",
              backgroundSize: "12px 12px",
            }}
          />
          <div
            className="pointer-events-none absolute inset-x-0 bottom-0 h-48"
            style={{ background: "radial-gradient(ellipse at center bottom, rgba(255,255,255,0.42), transparent 68%)" }}
          />
          {[
            { x: "12%", y: "22%", d: "0ms", px: "6px", py: "-4px" },
            { x: "22%", y: "70%", d: "250ms", px: "-5px", py: "3px" },
            { x: "78%", y: "28%", d: "500ms", px: "4px", py: "6px" },
            { x: "84%", y: "64%", d: "250ms", px: "-6px", py: "-3px" },
          ].map((dot) => (
            <span
              key={dot.x + dot.y}
              className="pulse-dot pointer-events-none absolute h-1.5 w-1.5 rounded-full bg-white/80"
              style={{ left: dot.x, top: dot.y, ["--d" as string]: dot.d, ["--pulse-x" as string]: dot.px, ["--pulse-y" as string]: dot.py }}
            />
          ))}
          <div className="relative mx-auto max-w-[920px]">
            <h1 className="text-balance text-[36px] font-medium leading-[0.99] tracking-[-1.2px] text-white md:text-[56px] md:leading-[55.44px] md:tracking-[-1.4px]">
              Pull every environment.
              <br />
              Production waits for review.
            </h1>
            <p className="mx-auto mt-6 max-w-[640px] text-[16px] leading-7 text-white/90 md:text-[18px]">
              Secrets and config for dev, staging, CI, and production. The CLI pulls them. A protected environment waits for a change request.
            </p>
            <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Pill href="/onboarding" kind="light" onClick={() => trackAction("landing_cta_clicked", { placement: "hero" })}>
                Start for free
              </Pill>
              <Pill href={runtimeConfig.docsUrl} kind="light-ghost" onClick={() => trackAction("landing_docs_clicked", { placement: "hero" })}>
                View docs
              </Pill>
            </div>
          </div>
        </div>
      </section>

      <section className="px-6 pb-8 pt-16 md:pt-24" data-motion="region">
        <h2 className={titleClass}>One store for every environment</h2>
        <p className="mx-auto mt-4 max-w-[640px] text-center text-[16px] leading-7 text-muted-foreground">
          Dev, staging, and production stay apart. The pull lands on the machine that asked for it.
        </p>
        <div className="mt-10">
          <HeroDiagram late />
        </div>
      </section>

      <section
        ref={benefitsRef}
        id="benefits"
        className={`mx-auto max-w-[1200px] px-6 pb-8 ${benefitsIn ? "is-in" : ""}`}
      >
        <div className="relative">
          <Corners />
          <div className="grid border-l border-t border-border sm:grid-cols-2 lg:grid-cols-3">
            {benefits.map((item) => (
              <div key={item.title} className="border-b border-r border-border px-6 py-8">
                <item.icon className="h-4 w-4 text-foreground" strokeWidth={1.5} />
                <h2 className="mt-4 text-[15px] font-semibold text-foreground">{item.title}</h2>
                <p className="mt-2 text-[14px] leading-6 text-muted-foreground">{item.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto grid max-w-[1200px] items-stretch gap-4 px-6 py-16 lg:grid-cols-2" data-motion="why">
        <div className="relative overflow-hidden rounded-lg border border-border bg-card px-8 py-10">
          <h2 className="max-w-[16ch] text-[32px] font-medium leading-[1.05] tracking-[-1px] text-foreground md:text-[40px]">
            Fighting drift with a pasted file
          </h2>
          <div className="mt-8 space-y-3">
            {noise.map((line) => (
              <p key={line} className="max-w-sm rounded-md border border-border bg-background px-4 py-3 text-[14px] text-muted-foreground">
                {line}
              </p>
            ))}
          </div>
          <div className="pointer-events-none mt-8 overflow-hidden text-[12px] text-accent-ink/70" data-motion="waveform">
            <div className="waveform font-mono">
              {[0, 1].map((copy) => (
                <span key={copy} className="px-4">
                  {". . . env drift . . . slack paste . . . prod copy . . . "}
                </span>
              ))}
            </div>
          </div>
        </div>
        <div className="relative flex flex-col justify-center overflow-hidden rounded-lg px-8 py-12 text-white" style={{ background: deep }}>
          <div
            className="pointer-events-none absolute inset-0 opacity-40"
            style={{
              backgroundImage: "radial-gradient(rgba(255,255,255,0.45) 0.7px, transparent 0.75px)",
              backgroundSize: "12px 12px",
            }}
          />
          <h2 className="relative text-[32px] font-medium leading-[1.05] tracking-[-1px] md:text-[40px]">
            Shipping with EnvSync
          </h2>
          <p className="relative mt-8 inline-flex w-fit items-center gap-2 rounded-full border border-white/40 px-4 py-2 text-[14px]">
            <Check className="h-4 w-4" />
            Approved cr_1041 for production
          </p>
        </div>
      </section>

      <section ref={compareRef} className={`px-6 py-20 ${compareIn ? "is-in" : ""}`} id="compare">
        <h2 className={`${titleClass} mx-auto max-w-[920px]`}>
          One store, from the ground up: EnvSync vs a pasted .env
        </h2>
        <p className="mx-auto mt-5 max-w-[640px] text-center text-[16px] leading-7 text-muted-foreground">
          A pasted file is copied per machine, and every copy can drift. EnvSync keeps the value once. Staging pulls it. Production changes when the request is approved.
        </p>
        <CompareDiagram />
      </section>

      <section ref={usesRef} className={`mx-auto max-w-[1200px] px-6 pb-8 ${usesIn ? "is-in" : ""}`} id="uses">
        <div className="relative">
          <Corners />
          <div className="grid border border-border lg:grid-cols-3">
          <div className="flex flex-col justify-start px-8 py-10 lg:row-span-2">
            <h2 className="text-[28px] font-medium leading-tight tracking-[-0.6px] text-foreground">
              You can use EnvSync to:
            </h2>
            <p className="mt-3 text-[15px] text-muted-foreground">The same organization, four jobs.</p>
            <Link
              to="/product/secrets"
              className="mt-6 inline-flex h-9 w-fit items-center rounded-full border border-border bg-transparent px-4 text-sm text-foreground"
            >
              See more
            </Link>
          </div>
          {[
            ["Pull into CI", "GitHub Actions and GitLab run envsync pull. The job names the environment. It does not get a file from the repo.", 0],
            ["Promote with a review", "A change request shows the diff. Production does not change until it is applied.", 1],
            ["Keep environments apart", "Dev, staging, and production are environment types, not copies of a file.", 2],
            ["Rotate and recover", "Rotate on a schedule. Point-in-time puts a bad push back.", 3],
          ].map(([title, body, kind], index) => (
            <article key={title as string} className="border-t border-border lg:border-l lg:[&:nth-child(-n+3)]:border-t-0">
              <div className={`illus illus-${"abcd"[index]} h-[140px] bg-card`}>
                <UseArt kind={kind as 0 | 1 | 2 | 3} />
              </div>
              <div className="px-6 py-5">
                <h3 className="text-[15px] font-semibold text-foreground">{title as string}</h3>
                <p className="mt-2 text-[14px] leading-6 text-muted-foreground">{body as string}</p>
              </div>
            </article>
          ))}
          </div>
        </div>
      </section>

      <section ref={platformRef} className={`mx-auto max-w-[1200px] px-6 py-20 ${platformIn ? "is-in" : ""}`}>
        <h2 className={`${titleClass} mx-auto max-w-[860px]`}>
          From a laptop pull to a gated production push
        </h2>
        <p className="mx-auto mt-5 max-w-[640px] text-center text-[16px] leading-7 text-muted-foreground">
          The same values in the CLI, the SDK, and the dashboard. Staging moves immediately. Production moves when someone approves the diff.
        </p>
        <div className="relative mt-12 grid overflow-hidden rounded-md border border-border bg-card lg:grid-cols-[1.3fr_0.7fr]">
          <Corners />
          <div className="min-h-[320px] bg-background p-5">
            <div className="flex gap-4 font-mono text-[13px]">
              {snippets.map((item, i) => (
                <button
                  key={item.id}
                  type="button"
                  className={i === snippet ? "text-foreground" : "text-muted-foreground"}
                  onClick={() => setSnippet(i)}
                >
                  {item.id}
                </button>
              ))}
            </div>
            <ol className="mt-6 space-y-2 font-mono text-[13px] leading-6">
              {snippets[snippet].lines.map((line, i) => (
                <li key={line} className="grid grid-cols-[28px_1fr] gap-3">
                  <span className="text-muted-foreground">{String(i + 1).padStart(2, "0")}</span>
                  <span className={i === 0 ? "text-accent-ink" : "text-muted-foreground"}>{line}</span>
                </li>
              ))}
            </ol>
          </div>
          <div className="divide-y divide-border border-t border-border lg:border-l lg:border-t-0">
            {notes.map((note) => (
              <div key={note.title} className={`px-6 py-6 ${note.accent ? "border-l-[3px] border-l-[#1dc379]" : ""}`}>
                <h3 className="text-[15px] font-semibold text-foreground">{note.title}</h3>
                <p className="mt-2 text-[14px] leading-6 text-muted-foreground">{note.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="px-6 pb-4 text-center">
        <h2 className="text-[22px] font-medium tracking-[-0.4px] text-foreground">Ship from the laptop</h2>
        <p className="mt-2 text-[15px] text-muted-foreground">Pull staging. Push production only when you mean to.</p>
        <div className="relative mx-auto mt-6 max-w-[640px] rounded-md border border-dashed border-border bg-card px-4 py-3 text-left">
          <p className="font-mono text-[14px] text-accent-ink">
            <span className="text-muted-foreground">$ </span>
            {command}
            <span className="cursor-pulse ml-0.5 inline-block h-4 w-[7px] translate-y-[2px] bg-[#1a9d5c]" data-motion="cursor" />
          </p>
          <button
            type="button"
            className="absolute bottom-2 right-2 rounded px-2 py-1 text-[11px] text-muted-foreground hover:text-foreground"
            onClick={() => {
              void navigator.clipboard?.writeText(command).then(() => {
                setCopied(true);
                window.setTimeout(() => setCopied(false), 1200);
              });
            }}
          >
            {copied ? "Copied" : "Copy"}
          </button>
        </div>
        <h3 className="mt-14 text-[22px] font-medium tracking-[-0.4px] text-foreground">…or from CI</h3>
        <p className="mx-auto mt-2 max-w-[520px] text-[15px] leading-7 text-muted-foreground">
          GitHub Actions and GitLab run the same pull. The job names the environment. It does not get a file from the repo.
        </p>
      </section>

      <ShipList />

      <section ref={priceRef} className={`mx-auto max-w-[880px] px-6 py-16 text-center ${priceIn ? "is-in" : ""}`} id="pricing-strip">
        <h2 className={titleClass}>Pricing</h2>
        <p className="mt-4 text-[15px] text-muted-foreground">
          Developer is free. Plus+ is $18 / month for the first 5 users, then $5 per additional user.{" "}
          <Link to="/pricing" className="underline decoration-border underline-offset-4 hover:decoration-foreground">
            View pricing
          </Link>
        </p>
        <div className="relative mt-8 overflow-hidden rounded-lg border border-border bg-card text-left">
          <Corners />
          <table className="w-full text-[14px]">
            <thead>
              <tr className="border-b border-border text-muted-foreground">
                <th className="px-5 py-3 text-left font-normal"> </th>
                <th className="px-5 py-3 text-left font-normal">Developer</th>
                <th className="px-5 py-3 text-left font-normal">Plus+</th>
                <th className="px-5 py-3 text-left font-normal">Enterprise</th>
              </tr>
            </thead>
            <tbody>
              {priceRows.map((row) => (
                <tr key={row[0]} className="border-b border-border/70 last:border-0">
                  {row.map((cell, i) => (
                    <td key={cell + i} className={`px-5 py-4 ${i === 0 ? "text-foreground" : "text-muted-foreground"}`}>
                      {i === 0 ? <KeyRound className="mr-2 inline h-3.5 w-3.5 text-muted-foreground" /> : null}
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section ref={dirRef} className={`mx-auto max-w-[1200px] px-6 py-16 ${dirIn ? "is-in" : ""}`}>
        <h2 className={`${titleClass} mx-auto max-w-[860px]`}>The parts, on one API</h2>
        <p className="mx-auto mt-4 max-w-[640px] text-center text-[16px] leading-7 text-muted-foreground">
          Projects, environments, approvals, certificates, and the CLI. Encrypted at rest and in transit.
        </p>
        <div className="relative mt-12">
          <Corners />
          <div className="grid border-l border-t border-border md:grid-cols-3">
          {directory.map((col) => (
            <div key={col.label} className="border-b border-r border-border px-8 py-8">
              <p className="text-[13px] text-muted-foreground">{col.label}</p>
              <ul className="mt-4 space-y-4">
                {col.items.map(([label, href]) => (
                  <li key={label}>
                    <Link to={href} className="text-[15px] font-medium text-foreground hover:text-accent-ink">
                      {label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
          </div>
        </div>
      </section>

      <section ref={closeRef} className={`px-2 pb-2 md:px-3 ${closeIn ? "is-in" : ""}`} id="close">
        <div className="relative overflow-hidden rounded-lg px-6 py-20 text-center" style={{ background: deep }}>
          <div
            className="pointer-events-none absolute inset-0 opacity-40"
            style={{
              backgroundImage: "radial-gradient(rgba(255,255,255,0.45) 0.7px, transparent 0.75px)",
              backgroundSize: "14px 14px",
            }}
          />
          {[
            { pos: "left-[7%] top-[14%]", Icon: Terminal },
            { pos: "left-[13%] top-[36%]", Icon: ShieldCheck },
            { pos: "right-[8%] top-[12%]", Icon: KeyRound },
            { pos: "right-[12%] top-[34%]", Icon: GitPullRequest },
          ].map(({ pos, Icon }) => (
            <div key={pos} className={`absolute hidden h-14 w-14 items-center justify-center rounded-md border border-dashed border-white/45 md:flex ${pos}`}>
              <Corners onGreen />
              <Icon className="h-5 w-5 text-white/80" strokeWidth={1.5} />
            </div>
          ))}
          <h2 className="relative mx-auto max-w-[1080px] text-balance text-[36px] font-medium leading-[0.99] tracking-[-1.2px] text-white md:text-[56px] md:leading-[55.44px] md:tracking-[-1.4px]">
            Ship without the drift.
          </h2>
          <p className="relative mx-auto mt-5 max-w-[560px] text-[16px] leading-7 text-white/90">
            Developer is free. One organization, five projects, three members.
          </p>
          <div className="relative mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Pill href="/onboarding" kind="light" onClick={() => trackAction("landing_cta_clicked", { placement: "close" })}>
              Start for free
            </Pill>
            <Pill href={runtimeConfig.docsUrl} kind="light-ghost" onClick={() => trackAction("landing_docs_clicked", { placement: "close" })}>
              View docs
            </Pill>
          </div>
          <div className="relative mt-12 overflow-hidden border-t border-white/20 pt-3">
            <div className="ticker-track" data-motion="ticker">
              {[0, 1].map((copy) => (
                <div key={copy} className="flex">
                  {ticker.map((item) => (
                    <span key={item + copy} className="px-6 text-[13px] text-white/90">
                      {item}
                    </span>
                  ))}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
