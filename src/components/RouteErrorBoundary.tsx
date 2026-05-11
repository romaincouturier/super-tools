import React from "react";
import { Button } from "@/components/ui/button";

type Props = { children: React.ReactNode };
type State = { hasError: boolean; error?: unknown };

const RELOAD_FLAG = "route-chunk-reload";

/**
 * Detect dynamic import / chunk loading failures (typical after a deploy: the
 * old client tries to fetch a hashed chunk filename that no longer exists).
 */
function isChunkLoadError(error: unknown): boolean {
  const msg =
    error instanceof Error
      ? `${error.name} ${error.message}`
      : String(error ?? "");
  return /Failed to fetch dynamically imported module|Loading chunk \d+ failed|Importing a module script failed|ChunkLoadError/i.test(
    msg,
  );
}

export class RouteErrorBoundary extends React.Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(error: unknown): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: unknown) {
    console.error("RouteErrorBoundary caught:", error);

    // Auto-recover from stale chunk errors by reloading once. The session
    // flag prevents a reload loop if the failure persists.
    if (isChunkLoadError(error)) {
      try {
        const already = sessionStorage.getItem(RELOAD_FLAG);
        if (!already) {
          sessionStorage.setItem(RELOAD_FLAG, String(Date.now()));
          window.location.reload();
          return;
        }
      } catch {
        // sessionStorage unavailable — fall through to manual reload UI.
      }
    } else {
      // Clear the guard on any non-chunk error so future stale-chunk errors
      // can still auto-reload.
      try {
        sessionStorage.removeItem(RELOAD_FLAG);
      } catch {
        // ignore
      }
    }
  }

  render() {
    if (!this.state.hasError) return this.props.children;

    const chunkError = isChunkLoadError(this.state.error);

    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-6">
        <div className="w-full max-w-md rounded-lg border bg-card text-card-foreground p-6 space-y-3">
          <h1 className="text-lg font-semibold">Erreur de chargement</h1>
          <p className="text-sm text-muted-foreground">
            {chunkError
              ? "Une nouvelle version de l'application est disponible. Rechargez la page pour la récupérer."
              : "Une erreur est survenue. Rechargez la page pour continuer."}
          </p>
          <div className="flex gap-2">
            <Button
              onClick={() => {
                try {
                  sessionStorage.removeItem(RELOAD_FLAG);
                } catch {
                  // ignore
                }
                window.location.reload();
              }}
            >
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
