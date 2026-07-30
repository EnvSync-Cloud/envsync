import type { Config } from "tailwindcss";
import tailwindcssAnimate from "tailwindcss-animate";

export default {
	darkMode: ["class"],
	content: [
		"./pages/**/*.{ts,tsx}",
		"./components/**/*.{ts,tsx}",
		"./app/**/*.{ts,tsx}",
		"./src/**/*.{ts,tsx}",
	],
	prefix: "",
	theme: {
		container: {
			center: true,
			padding: '2rem',
			screens: {
				'2xl': '1400px'
			}
		},
		extend: {
			fontFamily: {
				sans: ['"Inter"', 'system-ui', '-apple-system', '"Segoe UI"', 'Roboto', 'sans-serif'],
				mono: ['"JetBrains Mono"', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
			},
			fontSize: {
				'display': ['3.5rem', { lineHeight: '1', letterSpacing: '-1.4px' }],
				'h1': ['3rem', { lineHeight: '1', letterSpacing: '-1.2px' }],
				'h2': ['2rem', { lineHeight: '1.1', letterSpacing: '-0.8px' }],
				'h3': ['1.125rem', { lineHeight: '1.2', letterSpacing: '-0.45px' }],
				'lead': ['1.2rem', { lineHeight: '1.2', letterSpacing: '-0.48px' }],
				'mono-label': ['0.8125rem', { lineHeight: '1', letterSpacing: '0' }],
			},
			colors: {
				border: 'hsl(var(--border))',
				input: 'hsl(var(--input))',
				ring: 'hsl(var(--ring))',
				background: 'hsl(var(--background))',
				foreground: 'hsl(var(--foreground))',
				primary: {
					DEFAULT: 'hsl(var(--primary) / <alpha-value>)',
					foreground: 'hsl(var(--primary-foreground))',
					hover: 'hsl(var(--primary-hover))',
				},
				secondary: {
					DEFAULT: 'hsl(var(--secondary))',
					foreground: 'hsl(var(--secondary-foreground))',
				},
				destructive: {
					DEFAULT: 'hsl(var(--destructive))',
					foreground: 'hsl(var(--destructive-foreground))',
				},
				muted: {
					DEFAULT: 'hsl(var(--muted))',
					foreground: 'hsl(var(--muted-foreground))',
				},
				accent: {
					DEFAULT: 'hsl(var(--accent))',
					foreground: 'hsl(var(--accent-foreground))',
				},
				'accent-ink': 'hsl(var(--accent-ink))',
				'tertiary': 'hsl(var(--text-tertiary))',
				'accent-tint': 'hsl(var(--accent-tint) / <alpha-value>)',
				'accent-surface': 'hsl(var(--accent-surface))',
				'accent-outline': 'hsl(var(--accent-tint) / <alpha-value>)',
				'hero-text': 'hsl(var(--hero-text))',
				'status-warning': {
					DEFAULT: 'hsl(var(--status-warning) / <alpha-value>)',
					foreground: 'hsl(var(--warning-foreground))',
				},
				'status-error': 'hsl(var(--destructive) / <alpha-value>)',
				popover: {
					DEFAULT: 'hsl(var(--popover))',
					foreground: 'hsl(var(--popover-foreground))',
				},
				card: {
					DEFAULT: 'hsl(var(--card))',
					foreground: 'hsl(var(--card-foreground))',
				},
				sidebar: {
					DEFAULT: 'hsl(var(--sidebar-background))',
					foreground: 'hsl(var(--sidebar-foreground))',
					primary: 'hsl(var(--sidebar-primary))',
					'primary-foreground': 'hsl(var(--sidebar-primary-foreground))',
					accent: 'hsl(var(--sidebar-accent))',
					'accent-foreground': 'hsl(var(--sidebar-accent-foreground))',
					border: 'hsl(var(--sidebar-border))',
					ring: 'hsl(var(--sidebar-ring))',
				},
			},
			borderRadius: {
				xs: '3px',
				lg: 'var(--radius)',
				md: 'calc(var(--radius) - 2px)',
				sm: 'calc(var(--radius) - 4px)',
			},
		}
	},
	plugins: [tailwindcssAnimate],
} satisfies Config;
