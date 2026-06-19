import { Button } from "@/components/ui/button";

interface AppErrorFallbackProps {
  resetError: () => void;
}

/**
 * Fallback UI rendered by the top-level Sentry.ErrorBoundary when an unhandled
 * render error bubbles up past the route-level boundary.
 */
export function AppErrorFallback({ resetError }: AppErrorFallbackProps) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-6 text-center">
      <h1 className="text-xl font-semibold">Une erreur est survenue</h1>
      <p className="max-w-md text-sm text-muted-foreground">
        L'application a rencontré un problème inattendu. L'incident a été signalé
        automatiquement. Vous pouvez réessayer ou recharger la page.
      </p>
      <div className="flex gap-2">
        <Button variant="outline" onClick={resetError}>
          Réessayer
        </Button>
        <Button onClick={() => window.location.reload()}>Recharger la page</Button>
      </div>
    </div>
  );
}
