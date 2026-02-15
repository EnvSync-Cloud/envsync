import { Component, type ErrorInfo, type ReactNode } from "react";

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
  }

  render() {
    if (this.state.hasError && this.state.error) {
      return (
        <div className="min-h-screen bg-slate-900 text-white flex flex-col items-center justify-center px-4">
          <div className="max-w-md w-full space-y-4 text-center">
            <h1 className="text-xl font-bold text-white">Something went wrong</h1>
            <p className="text-slate-400 text-sm font-mono break-all">
              {this.state.error.message}
            </p>
            <button
              type="button"
              className="mt-4 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 rounded-md text-white text-sm"
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
