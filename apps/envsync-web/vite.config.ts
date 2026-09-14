import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react-swc";
import fs from "node:fs";
import path from "path";

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
      const edition = process.env.VITE_SERVER_LICENSE === "oss" ? "oss" : "enterprise";
      const deploymentMode = process.env.VITE_ENVSYNC_DEPLOYMENT_MODE === "hosted"
        ? "hosted"
        : "selfhosted";
      const config = {
        apiBaseUrl: apiBase,
        appBaseUrl: `${proto}//app.${root}`,
        authBaseUrl: `${proto}//auth.${root}`,
        managementApiUrl: `${apiBase}/api/v1/manage`,
        keycloakRealm: "envsync",
        webClientId: "envsync-web",
        apiDocsUrl: `${apiBase}/docs`,
        edition,
        dashboardVariant: edition,
        managementEnabled: edition === "enterprise",
        deploymentMode,
        canCreateOrganization: deploymentMode === "hosted",
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
const dashboardVariant = process.env.VITE_SERVER_LICENSE === "oss" ? "oss" : "enterprise";

const enterpriseModulesEntry =
  dashboardVariant === "enterprise"
    ? path.resolve(rootDir, "packages/envsync-enterprise-web/src/modules.ts")
    : path.resolve(__dirname, "./src/modules/enterprise-modules.stub.ts");

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  envDir: rootDir,
  server: {
    host: "0.0.0.0",
    port: 8001,
    allowedHosts: ["app.lvh.me", "api.lvh.me", "localhost", "127.0.0.1"],
  },
  plugins: [
    react(),
    hostedRuntimeConfigPlugin(),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      // Phase 5b: enterprise modules from proprietary package; OSS uses empty stub.
      "@enterprise-modules": enterpriseModulesEntry,
      // Enterprise package pages import shell chrome via @shell/*
      "@shell": path.resolve(__dirname, "./src"),
    },
  },
  optimizeDeps: {
    include: ["@envsync-cloud/envsync-ts-sdk"],
  },
  build: {
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes("node_modules")) return;
          if (id.includes("react-router")) return "router";
          if (id.includes("react-dom") || id.includes("/react/")) return "react-vendor";
          if (id.includes("@tanstack/react-query")) return "react-query";
          if (id.includes("@radix-ui")) return "radix";
          if (id.includes("recharts")) return "recharts";
          if (id.includes("lucide-react")) return "lucide";
          if (id.includes("@envsync-cloud/envsync-ts-sdk")) return "envsync-sdk";
          if (id.includes("date-fns")) return "date-fns";
          if (id.includes("clsx")) return "clsx";
          if (id.includes("embla-carousel-react")) return "embla-carousel-react";
          if (id.includes("zod")) return "zod";
          if (id.includes("react-hook-form")) return "react-hook-form";
          if (id.includes("react-day-picker")) return "react-day-picker";
        },
      },
    },
  },
}));
