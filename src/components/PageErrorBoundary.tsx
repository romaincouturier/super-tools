import React from "react";
import { Button } from "@/components/ui/button";
import { AlertTriangle, RefreshCw, Home } from "lucide-react";

interface Props {
  children: React.ReactNode;
  pageName?: string;
}

interface State {
  hasError: boolean;
  error?: unknown;
}

export class PageErrorBoundary extends React.Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(error: unknown): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: unknown, info: React.ErrorInfo) {
    console.error(
      `PageErrorBoundary [${this.props.pageName ?? "unknown"}]:`,
      error,
      info.componentStack,
    );
    // Report to Sentry if available
    import("@sentry/react")
      .then((Sentry) => {
        Sentry.captureException(error, {
          extra: { pageName: this.props.pageName, componentStack: info.componentStack },
        });
      })
      .catch(() => {
        /* Sentry not loaded */
      });
  }

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div className="flex items-center justify-center min-h-[60vh] p-6">
        <div className="w-full max-w-md rounded-lg border bg-card text-card-foreground p-6 space-y-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-destructive/10">
              <AlertTriangle className="h-5 w-5 text-destructive" />
            </div>
            <h2 className="text-lg font-semibold">
              Erreur{this.props.pageName ? ` — ${this.props.pageName}` : ""}
            </h2>
          </div>
          <p className="text-sm text-muted-foreground">
            Une erreur inattendue s'est produite sur cette page. Essayez de recharger ou revenez à
            l'accueil.
          </p>
          <div className="flex gap-2">
            <Button size="sm" onClick={() => this.setState({ hasError: false, error: undefined })}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Réessayer
            </Button>
            <Button size="sm" variant="outline" onClick={() => (window.location.href = "/")}>
              <Home className="h-4 w-4 mr-2" />
              Accueil
            </Button>
          </div>
          {import.meta.env.DEV && this.state.error ? (
            <pre className="text-xs whitespace-pre-wrap text-muted-foreground bg-muted p-2 rounded max-h-40 overflow-auto">
              {String((this.state.error as Error)?.message ?? this.state.error)}
            </pre>
          ) : null}
        </div>
      </div>
    );
  }
}

/** HOC to wrap a lazy-loaded page with an error boundary */
export function withPageErrorBoundary<P extends object>(
  Component: React.ComponentType<P>,
  pageName: string,
): React.FC<P> {
  const Wrapped: React.FC<P> = (props) => (
    <PageErrorBoundary pageName={pageName}>
      <Component {...props} />
    </PageErrorBoundary>
  );
  Wrapped.displayName = `withPageErrorBoundary(${pageName})`;
  return Wrapped;
}
