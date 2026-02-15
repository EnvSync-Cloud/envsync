import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

// Load .env from monorepo root (single source of truth)
const rootDir = path.resolve(__dirname, "../..");

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  envDir: rootDir,
  server: {
    host: "::",
    port: 8001,
  },
  plugins: [
    react(),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
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
