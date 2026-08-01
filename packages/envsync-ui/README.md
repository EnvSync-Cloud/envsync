# envsync-ui

**License:** MIT

Shared **design tokens** and **Tailwind preset** for EnvSync apps (D12 / H5).

## Contents

| Export | Use |
|--------|-----|
| `envsync-ui/tokens.css` | CSS variables (`:root` / `.dark`) |
| `envsync-ui/tailwind-preset` | Shared `theme.extend` colors, fonts, radii |

Not a full component library — apps keep their own shadcn/ui primitives.

## Usage

### CSS

```css
@import "envsync-ui/tokens.css";
@tailwind base;
@tailwind components;
@tailwind utilities;
```

### Tailwind

```ts
import type { Config } from "tailwindcss";
import envsyncUiPreset from "envsync-ui/tailwind-preset";

export default {
  presets: [envsyncUiPreset],
  content: ["./src/**/*.{ts,tsx}"],
  // app-specific theme/plugins only
} satisfies Config;
```

### Consumers

- `apps/envsync-web`
- `apps/envsync-landing`
- `packages/envsync-enterprise-web` (via shell chrome)

Brand anchor: `--primary: 153 74% 44%` (EnvSync green).
