import { initTelemetry } from "@/telemetry";

initTelemetry();

import { createRoot } from "react-dom/client";
import { ThemeProvider } from "next-themes";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import App from "./App.tsx";
import "./index.css";

const root = document.getElementById("root");
if (!root) {
  throw new Error("Root element #root not found");
}

createRoot(root).render(
  <ThemeProvider attribute="class" defaultTheme="dark" enableSystem storageKey="envsync-theme">
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </ThemeProvider>
);
