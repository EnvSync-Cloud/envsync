import type { Config } from "tailwindcss";
import tailwindcssAnimate from "tailwindcss-animate";
import envsyncUiPreset from "envsync-ui/tailwind-preset";

export default {
	darkMode: ["class"],
	presets: [envsyncUiPreset],
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
			padding: "2rem",
			screens: {
				"2xl": "1400px",
			},
		},
		extend: {},
	},
	plugins: [tailwindcssAnimate],
} satisfies Config;
