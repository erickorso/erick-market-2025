import React from "react";
import { reportError } from "../../services/reporter";

type Props = {
  children: React.ReactNode;
  /** Named in the error report so you can tell which boundary tripped. */
  source: string;
  /** Rendered instead of the default panel — use for small inline areas. */
  fallback?: React.ReactNode;
  /** Copy for the default panel, passed in so this stays i18n-agnostic. */
  labels?: {
    title: string;
    body: string;
    reload: string;
    details: string;
  };
};

type State = { error: Error | null };

/**
 * Stops one broken subtree from blanking the page. Mounted around the whole
 * app and, more narrowly, around the two third-party-heavy areas: the Three.js
 * background and the recharts panels.
 */
class ErrorBoundary extends React.Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    reportError(error, `boundary:${this.props.source}`, {
      componentStack: info.componentStack ?? undefined,
    });
  }

  componentDidUpdate(prev: Props) {
    // A route change should give the subtree another chance rather than
    // leaving the fallback up until a manual reload.
    if (this.state.error && prev.children !== this.props.children) {
      this.setState({ error: null });
    }
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;
    if (this.props.fallback !== undefined) return this.props.fallback;

    const labels = this.props.labels ?? {
      title: "Something broke on this screen",
      body: "The rest of the app is still running. Reload to try again.",
      reload: "Reload",
      details: "Technical details",
    };

    return (
      <div
        role="alert"
        className="mx-auto my-8 max-w-md rounded-xl border border-rose-500/40 bg-gray-900 p-6 text-center"
      >
        <h2 className="mb-2 text-lg font-semibold text-rose-300">
          {labels.title}
        </h2>
        <p className="mb-4 text-sm text-slate-600 dark:text-gray-400">{labels.body}</p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="rounded-lg bg-teal-700 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-800"
        >
          {labels.reload}
        </button>
        <details className="mt-4 text-left">
          <summary className="cursor-pointer text-xs text-slate-600 dark:text-gray-400">
            {labels.details}
          </summary>
          <pre className="mt-2 overflow-x-auto whitespace-pre-wrap break-words text-[11px] text-slate-600 dark:text-gray-400">
            {error.message}
          </pre>
        </details>
      </div>
    );
  }
}

export default ErrorBoundary;
