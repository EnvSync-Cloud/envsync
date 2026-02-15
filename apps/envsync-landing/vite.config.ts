import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// Load .env from monorepo root (single source of truth)
const rootDir = path.resolve(__dirname, "../..");

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  envDir: rootDir,
  server: {
    host: "::",
    port: 8002,
  },
  plugins: [
    react(),
    mode === 'development' &&
    componentTagger(),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
