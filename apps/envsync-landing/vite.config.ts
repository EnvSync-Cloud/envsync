import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react-swc";
import fs from "node:fs";
import path from "path";
import { componentTagger } from "lovable-tagger";

function hostedRuntimeConfigPlugin(): Plugin {
  return {
    name: "hosted-runtime-config",
    closeBundle() {
      const api = process.env.VITE_API_BASE_URL;
      if (!api) return;
      let apiUrl: URL;
      try {
        apiUrl = new URL(api);
      } catch {
        return;
      }
      if (apiUrl.hostname === "localhost" || apiUrl.hostname.endsWith(".lvh.me")) return;
      const root = apiUrl.hostname.replace(/^api\./, "");
      const proto = apiUrl.protocol;
      const apiBase = api.replace(/\/$/, "");
      const track = `${proto}//t.${root}`;
      const otel = `${track}/obs`;
      const config = {
        apiBaseUrl: apiBase,
        appBaseUrl: `${proto}//app.${root}`,
        authBaseUrl: `${proto}//auth.${root}`,
        keycloakRealm: "envsync",
        webClientId: "envsync-web",
        apiDocsUrl: `${apiBase}/docs`,
        otelEndpoint: otel,
        hyperdxUrl: otel,
        hyperdxApiKey: process.env.VITE_HYPERDX_API_KEY || undefined,
        hyperdxDisabled: process.env.VITE_HYPERDX_DISABLED === "true",
        posthogKey: process.env.VITE_POSTHOG_KEY || process.env.VITE_POSTHOG_PROJECT_TOKEN || undefined,
        posthogHost: process.env.VITE_POSTHOG_HOST || `${track}/ph`,
        posthogDisabled: process.env.VITE_POSTHOG_DISABLED === "true",
      };
      fs.writeFileSync(
        path.resolve(__dirname, "dist/runtime-config.js"),
        `window.__ENVSYNC_RUNTIME_CONFIG__ = ${JSON.stringify(config, null, 2)};\n`,
      );
    },
  };
}

// Load .env from monorepo root (single source of truth)
const rootDir = path.resolve(__dirname, "../..");

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  envDir: rootDir,
  server: {
    host: "0.0.0.0",
    port: 8002,
    allowedHosts: ["localhost", "127.0.0.1", "landing.lvh.me"],
  },
  plugins: [
    react(),
    hostedRuntimeConfigPlugin(),
    mode === 'development' &&
    componentTagger(),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
    dedupe: ['react', 'react-dom'],
  },
}));
