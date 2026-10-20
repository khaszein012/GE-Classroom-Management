import { Component, type ErrorInfo, type ReactNode } from "react";

interface State {
  error: Error | null;
}

/** Catch render crashes and show a reload button instead of a blank page. */
export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Unhandled render error", error, info.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="flex min-h-screen items-center justify-center bg-ink-50 px-4 dark:bg-ink-950">
        <div className="w-full max-w-sm rounded-card border border-ink-200/70 bg-warm-ivory p-6 text-center shadow-soft dark:border-ink-800/70 dark:bg-ink-900">
          <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-card bg-warm-brick/10 dark:bg-warm-brick/15">
            <span className="text-xl">⚠️</span>
          </div>
          <h1 className="text-base font-semibold text-ink-900 dark:text-warm-ivory">Something went wrong</h1>
          <p className="mt-2 break-words text-sm text-ink-500 dark:text-ink-400">{this.state.error.message}</p>
          <button
            onClick={() => window.location.reload()}
            className="mt-5 rounded-button bg-obsidian dark:bg-antique-gold dark:text-obsidian px-4 py-2.5 text-sm font-semibold text-warm-ivory transition-colors hover:bg-ink-700 dark:hover:bg-deep-gold"
          >
            Reload
          </button>
        </div>
      </div>
    );
  }
}
