# envsync-ui

**License:** MIT

Shared design system for EnvSync apps: tokens, Tailwind preset, and primitives.

## Contents

| Export | Use |
|--------|-----|
| `envsync-ui/tokens.css` | CSS variables (`:root` / `.dark`) |
| `envsync-ui/tailwind-preset` | Shared `theme.extend` |
| `envsync-ui/cn` | `cn()` class merge helper |
| `envsync-ui/button` | `Button` |
| `envsync-ui/badge` | `Badge` |
| `envsync-ui/card` | `Card` + header/content/footer |
| `envsync-ui/input` | `Input` |

P2 starts a real component library (not tokens-only). Apps may re-export from
`@/components/ui/*` for compatibility; prefer package imports for new code.

## Usage

```tsx
import { Button } from "envsync-ui/button";
import { cn } from "envsync-ui/cn";
```

### Tailwind

```ts
import envsyncUiPreset from "envsync-ui/tailwind-preset";

export default {
  presets: [envsyncUiPreset],
  content: [
    "./src/**/*.{ts,tsx}",
    "../../packages/envsync-ui/src/**/*.{ts,tsx}",
  ],
} satisfies import("tailwindcss").Config;
```

### Consumers

- `apps/envsync-web` (re-exports primitives under `components/ui`)
- `apps/envsync-landing`
- `packages/envsync-enterprise-web` (via shell or direct package)

Brand anchor: `--primary: 153 74% 44%`.
