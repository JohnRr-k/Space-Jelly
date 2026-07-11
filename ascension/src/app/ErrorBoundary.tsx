import { Component } from "react";
import type { ErrorInfo, ReactNode } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

/** Last line of defense — ASCENSION must never greet Russ with a white page. */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("ASCENSION crashed:", error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="shell">
          <div className="wordmark">ASCENSION</div>
          <div className="card">
            <h1 className="display" style={{ fontSize: 22, marginBottom: 8 }}>
              Something broke. Not you.
            </h1>
            <p style={{ color: "var(--text-dim)", marginBottom: 18 }}>
              Reload to continue. Your data is stored on this device and is
              safe.
            </p>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => window.location.reload()}
            >
              Reload
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
