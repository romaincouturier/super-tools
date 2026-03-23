import React from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

function isChunkLoadError(error: unknown) {
  const message = String((error instanceof Error ? error.message : error) ?? "");
  return (
    message.includes("Failed to fetch dynamically imported module") ||
    message.includes("Importing a module script failed") ||
    message.includes("Loading chunk")
  );
}

type Props = { children: React.ReactNode };
type State = { hasError: boolean; error?: unknown };

/**
 * Catches both render errors and chunk-load failures.
 * For chunk errors a reload toast is shown; for other errors a fallback UI.
 */
export class RouteErrorBoundary extends React.Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(error: unknown): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: unknown) {
    console.error("RouteErrorBoundary caught:", error);

    if (isChunkLoadError(error)) {
      toast.error(
        "Une mise à jour est disponible. Veuillez recharger la page.",
        {
          duration: Infinity,
          action: { label: "Recharger", onClick: () => window.location.reload() },
        }
      );
    }
  }

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-6">
        <div className="w-full max-w-md rounded-lg border bg-card text-card-foreground p-6 space-y-3">
          <h1 className="text-lg font-semibold">Erreur de chargement</h1>
          <p className="text-sm text-muted-foreground">
            Un module n'a pas pu être chargé (souvent après une mise à jour). Un rechargement corrige
            généralement le problème.
          </p>
          <div className="flex gap-2">
            <Button onClick={() => window.location.reload()}>Recharger</Button>
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
