import { initTelemetry } from "@/telemetry";

initTelemetry();

import { createRoot } from "react-dom/client";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import App from "./App.tsx";
import "./index.css";

const root = document.getElementById("root");
if (!root) {
  throw new Error("Root element #root not found");
}

createRoot(root).render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>
);
