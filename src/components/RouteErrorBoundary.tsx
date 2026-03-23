import React from "react";
import { Button } from "@/components/ui/button";

type Props = { children: React.ReactNode };
type State = { hasError: boolean; error?: unknown };

export class RouteErrorBoundary extends React.Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(error: unknown): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: unknown) {
    console.error("RouteErrorBoundary caught:", error);
  }

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-6">
        <div className="w-full max-w-md rounded-lg border bg-card text-card-foreground p-6 space-y-3">
          <h1 className="text-lg font-semibold">Erreur de chargement</h1>
          <p className="text-sm text-muted-foreground">
            Une erreur est survenue. Rechargez la page pour continuer.
          </p>
          <div className="flex gap-2">
            <Button onClick={() => window.location.reload()}>
              Recharger
            </Button>
            <Button
              variant="outline"
              onClick={() => this.setState({ hasError: false, error: undefined })}
            >
              Réessayer
            </Button>
          </div>
          {import.meta.env.DEV && this.state.error ? (
            <pre className="text-xs whitespace-pre-wrap text-muted-foreground">
              {String(this.state.error instanceof Error ? this.state.error.message : this.state.error)}
            </pre>
          ) : null}
        </div>
      </div>
    );
  }
}
