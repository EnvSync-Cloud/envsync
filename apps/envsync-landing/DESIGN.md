# EnvSync Landing Design System

Cloudflare's design language replicated for EnvSync: hairline blueprint structure, editorial grotesk type at weight 500, one disciplined accent (EnvSync green), and product storytelling through faux UI, blueprint diagrams, and mono annotations. Extracted from runtime truth on cloudflare.com (home + /products/workers), 2026-07-23.

## 0. Research Log

- Live reference (clone-from-url): runtime `getComputedStyle` extraction on cloudflare.com home + /products/workers at 1440/768/390, hover/active states driven, full scroll-through; evidence in `docs/audit/cloudflare/**` → picked as the visual contract per user direction.
- Librarian lane: public CF design references (brand oranges, cf-ui/kumo, color-system blog) → cross-validated extraction; browser won all conflicts (see `docs/audit/gap-analysis.md` §8).
- Current-state lane: envsync.cloud captured with the same matrix (`docs/audit/envsync-current/**`) + code audit (`docs/audit/code-audit.md`).
- Decisions: D1 light+dark both · D2 EnvSync green in CF structure · D3 Index+Integrations+About+NotFound · D4 Inter + JetBrains Mono (CF uses licensed FT Kunst Grotesk / Apercu Mono Pro — free-fidelity substitutes).

## 1. Atmosphere & Identity

An engineering blueprint for your secrets. Quiet, precise, structural — surfaces separated by 1px hairlines, technical panels marked with crop-mark corners, every technical label in monospace. The signature is the **accent canvas**: a full-bleed EnvSync-green field inset in the white page frame, carrying a single editorial headline — the moment a visitor remembers. Depth comes from surface contrast and tint, never from shadow stacks.

## 2. Color

### Palette

| Role | Token | Light | Dark | Usage |
|---|---|---|---|---|
| Surface/primary | --surface-primary | #FFFFFF | #0C0E13 | Page floor |
| Surface/secondary | --surface-secondary | #FDFDFC | #10141A | Panels, hairline cards |
| Surface/elevated | --surface-elevated | #FFFFFF | #151A22 | Popovers, dropdowns |
| Text/primary | --text-primary | #262626 | #F3F5F7 | Headlines, body |
| Text/secondary | --text-secondary | #707070 | #9FA7B2 | Captions, inactive tabs |
| Text/tertiary | --text-tertiary | #6B6B6B | #8E97A4 | Disabled, meta (AA-verified ≥4.5:1 via Lighthouse) |
| Border/default | --border-default | #F0F0F0 | #1E242E | Hairlines everywhere |
| Border/strong | --border-strong | #E5E5E5 | #2E3642 | Inputs, emphasized frames |
| Accent/primary | --accent-primary | #1DC379 | #1DC379 | THE accent: hero canvas, primary CTA, active tab, tinted panels |
| Accent/hover | --accent-hover | #17AC6A | #2BD98A | Hover on accent fills |
| Accent/ink | --accent-ink | #0F7A4B | #2BD98A | Accent as TEXT on light (≥4.5:1 AA — verify in showcase gate) |
| Accent/foreground | --accent-foreground | #07130D | #07130D | Text/icons on accent fills |
| Accent/tint | --accent-tint | rgb(29 195 121 / 0.08) | rgb(29 195 121 / 0.12) | Tinted panels (CF peach-card role) |
| Accent/surface | --accent-surface | #EAF9F2 | #0E201D | Opaque tint surfaces (compare column, current-row highlight) — solid, no texture bleed-through |
| Accent/outline | --accent-outline | rgb(29 195 121 / 0.35) | rgb(29 195 121 / 0.4) | Accent hairlines, stat callouts |
| Status/warning | --status-warning | #B45309 | #F59E0B | Approval-pending states |
| Status/error | --status-error | #B52931 | #EF4444 | Errors (CF emergency red) |
| Hero/canvas-text | --hero-text | #FFFFFF | #FFFFFF | Text on accent canvas |

### Rules
- One accent, used surgically: canvas, primary CTA, active states, tint panels, blueprint diagram fills. Never decoration on every icon/heading.
- Accent is never small text on light surfaces — use --accent-ink for links/labels.
- Tint ramp uses alpha steps of the accent (0.05 / 0.08 / 0.12 / 0.35), mirroring CF's oklab alpha system.
- On the always-dark product surfaces (Terminal, ActivityStream frame), the accent is rendered as raw `#1DC379` — wave dots, status dot, success glyphs. Documented intentional hardcode, same precedent as Terminal.
- Never introduce a color not in this table. Extend the table first.

### Implementation note (token naming)

The codebase implements this palette with shadcn-compatible CSS variable names (load-bearing for `components/ui/*`). Mapping: `--surface-primary` → `--background` · `--surface-secondary` → `--card` · `--surface-elevated` → `--popover` · `--text-primary` → `--foreground` · `--text-secondary` → `--muted-foreground` · `--text-tertiary` → `--text-tertiary` · `--border-default` → `--border` · `--border/strong` → `--input` · `--accent-primary` → `--primary` · `--accent/hover` → `--primary-hover` · `--accent/foreground` → `--primary-foreground` · `--accent/tint` & `--accent/outline` → `--accent-tint` (alpha-value plumbed) · `--hero/canvas-text` → `--hero-text`. Section-2 role names are the contract; the mapping above is how to read them in code.

## 3. Typography

### Scale

| Level | Size | Weight | Line Height | Tracking | Usage |
|---|---|---|---|---|---|
| Display | 56px / 3.5rem | 500 | 1.0 | -1.4px | Hero headline (clamp to 36px at 390px) |
| H1 | 48px / 3rem | 500 | 1.0 | -1.2px | Section headers ("Region: Earth" role) |
| H2 | 32px / 2rem | 500 | 1.1 | -0.8px | Sub-section headers, large numerals |
| H3 | 18px / 1.125rem | 500 | 1.2 | -0.45px | Card/panel titles |
| Lead | 19.2px / 1.2rem | 400 | 1.2 | -0.48px | Hero sub-copy |
| Body | 16px / 1rem | 400 | 24px (1.5) | 0 | Default text |
| Body/sm | 14px / 0.875rem | 400 | 20px | 0 | Secondary info |
| Caption | 12px / 0.75rem | 400 | 16px | 0 | Meta (never below 12px) |
| Mono/label | 13px / 0.8125rem | 400 | 16px | 0 | Technical labels, annotations (JetBrains Mono) |
| Mono/code | 14px / 0.875rem | 400 | 20px | 0 | Code blocks, terminal |

### Font Stack
- Primary: `"Inter", system-ui, -apple-system, "Segoe UI", Roboto, sans-serif` — self-hosted woff2, weights **400 and 500 only**, `font-display: swap`.
- Mono: `"JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, monospace` — weight 400.

### Rules
- Weights 400/500 only. **No 600/700 anywhere** — emphasis comes from size, tracking, and accent, not bold.
- All display/headline text uses the negative tracking above; never looser than 0.
- Mono is the voice of all technical content: commands, versions, statuses, annotations, tab labels.

## 4. Spacing & Layout

### Base Unit — 4px

| Token | Value | Usage |
|---|---|---|
| --space-1 | 4px | Icon-to-label, tight gaps |
| --space-2 | 8px | Inline groups, chip padding |
| --space-3 | 12px | Button x-padding (sm), list items |
| --space-4 | 16px | Card padding (compact), nav link padding context |
| --space-6 | 24px | Card padding (default), CTA x-padding |
| --space-8 | 32px | Section side gutter (px-section), card group gaps |
| --space-10 | 40px | Accent-panel padding |
| --space-12 | 48px | Between content bands |
| --space-16 | 64px | Major section rhythm |
| --space-24 | 96px | Hero vertical padding |

### Grid
- Max content width: 1080px (text/headlines) · 1280px (diagrams, logo walls) · 1480px (footer).
- Section gutters: 32px sides (16px below 640px).
- Nav: 72px height; nav row 36px items.
- Breakpoints: sm 640, md 768, lg 1024, xl 1280, 2xl 1400 (container).

### Rules
- Alternating dense/generous bands: hero (generous) → dense visual (diagram/wall) → generous 3-up → dense showcase → generous split → CTA.
- No magic numbers; every spacing value maps to a token.

## 5. Components

### Button
- **Structure**: `<a>/<button>` pill, inline-flex, gap-2, font 16px/500.
- **Variants**: `primary` (accent fill, accent-foreground text, 9999px radius), `hero` (white fill #FFF, #1F1F1F text, on accent canvas), `outline` (transparent, 1px border-default, 9999px), `nav-cta` (primary at `scale(0.92)`, 35px h), `ghost-inverse` (transparent + white 1px border + white text — hero hover state).
- **Spacing**: sm `6px 12px` (nav, 36px h) · default `8px 16px` · lg `12px 24px` (46px h).
- **States**: default / hover `opacity: 0.95` (hero button: inverts to ghost-inverse) / active `translate-y-[1px]` / focus-visible `ring 3px accent/35% + 0.5px outline offset-2` / disabled `opacity-50 pointer-events-none`.
- **Motion**: `0.16s cubic-bezier(0.25,0.46,0.45,0.94)` on scale/translate/opacity.

### Nav
- 72px header, white (light) / surface-primary (dark), hairline bottom border; logo left; center links 16px/500, `6px 12px`, 6px radius, hover opens mega-menu (no color change); right cluster: outline pills + accent nav-cta.

### Announcement pill
- Outline pill, 14px, mono separators (·), 1px border at accent/35% over canvas or border-default on white; optional trailing mono link.

### Card (hairline)
- **Structure**: surface-secondary bg, 1px border-default, 8px radius, 24px padding.
- **Variants**: `default` · `tint` (accent-tint bg + accent-outline border — the "Paid card" role) · `blueprint` (adds crop-mark corners + mono annotations, dashed-border sub-regions = "free/absent", solid accent = "paid/present").
- **States**: hover = border-strong (no lift, no shadow); interactive cards get button motion contract.

### Section heading
- H1 48px/500 centered or left + Lead 19.2px text-secondary; 16px gap; 48-64px below content.

### Stat callout
- 1px accent-outline box, 8px radius, 24px padding; H3 numerals (500) + body/sm secondary; mono label above.

### Terminal / CodeBlock
- surface-primary dark panel (always dark, both themes — product surface), 1px border-strong, 8px radius; header row with mono file/context label (traffic-light dots allowed, 3×12px); JetBrains Mono 14px; status lines: success = accent, warning = --status-warning, neutral = text-secondary; **no emojis** — mono status glyphs (`✓`, `!`, `→`) only.

### ActivityStream frame (dark product surface)
- **Structure**: `<section>` shell (hairline top, bg-background) → SectionHeading (eyebrow "ACTIVITY") → frame `relative overflow-hidden rounded-lg h-[420px] md:h-[520px]` containing: WaveCanvas (z-0, opacity .72) → grid overlay (z-1, hero-text/0.07, 64px, vertical mask fade) → alert-card layer (z-3) → edge fade (z-4, `#0C0E13` 12%→transparent→84%) → status + caption labels (z-6, mono-label uppercase).
- **Surface**: always dark both themes — `bg-[#0C0E13]`, `border-[#2E3642]` (Terminal family values, intentional hardcode).
- **Status**: mono-label "Configuration activity" + 6px dot `#1DC379` with `0 0 12px #1DC379` glow. **Caption**: accent numeral + "Versioned changes moving dev → production".
- **Alert cards**: `w-[clamp(190px,21vw,270px)]`, `rounded-lg border border-dashed border-[hsl(0_0%_100%/0.18)] bg-[rgba(16,20,26,0.9)] backdrop-blur-md shadow-[0_16px_50px_rgba(0,0,0,0.34)]`; 24px mono glyph circle icon; mono 10px copy / 11px title; tone-colored icon + label (primary / status-warning / status-error); optional stack duplicates (+24px/+28px offsets); inner surface owns `card-float` keyframes (translateY ±N/2, ease-in-out alternate 3.2–5s) — outer element travels, inner floats, transforms never fight.
- **States**: cards travel per §6 WAAPI rules; reduced-motion = 4 static cards (positions per concept, first 4 visible); off-screen = all animations paused via IntersectionObserver.

### WaveCanvas
- `<canvas>` dot-waveform: 1.5px dots on 6px grid, stepped (not sine) amplitudes from deterministic sin-hash, center line at 54% height, scrolls left, alpha falls off from center, color `#1DC379` (intentional, see §2). DPR capped at 2, ResizeObserver, rAF, reduced-motion freezes elapsed. Props: `color?: string` (default `#1DC379`), `className`.

### DotTexture
- Single implementation of the accent-canvas texture (shared by hero + CTA): absolute layer, `radial-gradient(circle, hsl(var(--hero-text)/0.22) 1px, transparent 1px)` at 10px grid + `radial-gradient(60% 50% at 50% 100%, hsl(var(--hero-text)/0.24), transparent 70%)` glow. Props: `dotAlpha`, `glowAlpha` (defaults as shown).

### Tab pills
- Pill row, icon + 16px/500 text, `10px 14px`; active = accent fill + accent-foreground; inactive = transparent + 1px border-default, hover border-strong.

### Logo wall
- Hairline grid cells (1px border-default shared), logo SVGs at text-tertiary, hover = text-primary; optional tabbed case-study row below (16px/400, active ink vs inactive secondary, 2px bottom border).

### Split panel
- 50/50 grid: left = hairline card; right = solid accent panel (40px padding, white icon + H3 + body in hero-text).

### Crop-mark frame
- Blueprint wrapper: relative panel + 4 absolute 8×8px corner ticks (1px border-strong L-shapes). Used on diagrams, terminal, faux UI, pricing panels.

### Footer
- 1480px max, hairline top, 4-column link groups (14px, secondary → primary on hover), mono version/sha label.

## 6. Motion & Interaction

### Timing

| Type | Duration | Easing | Usage |
|---|---|---|---|
| Interactive | 200ms | cubic-bezier(0.19, 1, 0.22, 1) | Link/color/hover transitions (CF expo-out) |
| Button | 160ms | cubic-bezier(0.25, 0.46, 0.45, 0.94) | scale / translate / opacity on buttons |
| Section entrance | 2000ms | cubic-bezier(0.19, 1, 0.22, 1) | opacity fade on scroll into view (IntersectionObserver) |
| Beam border | 4s loop | linear | conic-gradient `@property --beam-angle` rotation on quote card |
| Card travel (ActivityStream) | 7–9.5s per card | linear | WAAPI: xPercent −35 → 220 horizontal travel, infinite, `endDelay` 700ms; per-card delay |
| Card fade (ActivityStream) | 400ms in / 400ms out | cubic-bezier(0.25, 0.46, 0.45, 0.94) (power2.in/out) | travel endpoints: opacity 0→.94→0, scale .72→1→.72 |
| Card float (ActivityStream) | 3.2–5s alternate | ease-in-out | inner surface translateY ±N/2 (CSS keyframes, independent of travel) |
| Wave scroll (WaveCanvas) | continuous | rAF-driven | dot grid drifts left, `elapsed * 0.018` px/frame budget |

### Rules
- Only `transform`, `opacity`, `filter`. Never layout properties.
- Every interactive element: hover + active + focus-visible states per Section 5.
- Section entrances: opacity fade only (no slide) — CF uses pure fades.
- `prefers-reduced-motion`: disable beam, entrance fades become instant.

## 7. Depth & Surface

**Strategy: borders-only.** 1px hairlines (border-default) are the structural device; surfaces separated by tonal shift (white / #FDFDFC / accent-tint). No shadow tier on cards.

**Texture rule — grid-box:** `.bg-grid-box` (`linear-gradient(hsl(var(--border)/0.7) 1px, transparent 1px)` ×2 at 36px) is the default texture on middle content sections (Features, HowItWorks, Integrations, Testimonial, Compare). Accent canvases (hero, CTA), dark product surfaces (Terminal, ActivityStream frame), and the footer stay untextured. The accent-canvas dot texture lives only on those canvases, implemented once in DotTexture (§5).

| Exception | Value | Usage |
|---|---|---|
| Popover/dropdown | 0 1px 3px rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1) | Menus over content |
| Accent ambient | 0 4px 60px rgb(29 195 121 / 0.08) | Feature blueprint panels only |
| White inset | inset 0 0 0 1px rgb(255 255 255 / 0.2) | Accent-canvas panels |

## 8. Accessibility Constraints & Accepted Debt

### Constraints
- WCAG 2.2 AA: ≥4.5:1 body text, ≥3:1 large text (≥24px or ≥18.66px 500-weight).
- Accent #1DC379 on white ≈ 2.3:1 → **never text on light**; accent fills always pair with --accent-foreground (#07130D, ≈9:1). Links/labels on light use --accent-ink (#0F7A4B). Verified in the primitive showcase gate before product sections.
- Visible focus ring (3px accent/35%) on every interactive element, both themes.
- Full keyboard reachability; skip-to-content link retained.
- `prefers-reduced-motion` respected (Section 6).

### Accepted Debt
| Item | Location | Why accepted | Owner / Exit |
|---|---|---|---|
| Invite/accept pages keep old ad-hoc styling | AcceptUserInvite, AcceptOrgInvite, Onboarding | Out of Phase-1 scope (D3); user sign-off 2026-07-23. `--surface-*` refs mechanically remapped to live tokens 2026-07-23 so they render whole. | Phase 2 re-tokenization |
| FT Kunst Grotesk substituted with Inter | Global | Licensed commercial font; Inter is the free-fidelity match at 400/500 | Revisit only if brand licenses Kunst |
| 1.6MB JS bundle (OTel/HyperDX telemetry) — render-blocking ~900ms mobile, ~260KiB unused JS, unload-handler deprecation, no sourcemaps | src/telemetry/*, vite build | Platform observability contract, pre-existing and out of redesign scope; Lighthouse mobile Perf 77 (desktop 99) is attributable to this, not the design system. Recorded 2026-07-23. | Platform team: route-level code-splitting + lazy telemetry init |
| 4 pre-existing conditional-hook lint errors | AcceptUserInvite, AcceptOrgInvite | Pre-existing logic bug in out-of-scope pages; redesign must not change behavior | Platform team, separate fix |
