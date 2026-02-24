import { Component, type ErrorInfo, type ReactNode } from "react";
import { trace, context, SpanStatusCode } from "@opentelemetry/api";
import { SeverityNumber } from "@opentelemetry/api-logs";
import { getLoggerProvider } from "@/telemetry/logs";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("App error:", error, errorInfo);

    const activeSpan = trace.getSpan(context.active());
    if (activeSpan) {
      activeSpan.setStatus({ code: SpanStatusCode.ERROR, message: error.message });
      activeSpan.recordException(error);
    }

    const loggerProvider = getLoggerProvider();
    if (loggerProvider) {
      const logger = loggerProvider.getLogger("error-boundary");
      logger.emit({
        severityNumber: SeverityNumber.ERROR,
        severityText: "ERROR",
        body: error.message,
        attributes: {
          "error.type": "react.error_boundary",
          "error.stack": error.stack ?? "",
          "error.component_stack": errorInfo.componentStack ?? "",
        },
      });
    }
  }

  render() {
    if (this.state.hasError && this.state.error) {
      return (
        <div className="min-h-screen bg-[#0a0f1a] text-white flex flex-col items-center justify-center px-4">
          <div className="max-w-md w-full space-y-4 text-center">
            <h1 className="text-xl font-bold text-white">Something went wrong</h1>
            <p className="text-gray-400 text-sm font-mono break-all">
              {this.state.error.message}
            </p>
            <button
              type="button"
              className="mt-4 px-4 py-2 bg-violet-500 hover:bg-violet-600 rounded-md text-white text-sm"
              onClick={() => this.setState({ hasError: false, error: null })}
            >
              Try again
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
