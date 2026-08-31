import { Button } from "@/components/ui/button";
import { WifiOff } from "lucide-react";

type Props = {
  /** true tant que la requête tourne */
  isLoading: boolean;
  /** erreur de la requête (réseau, RLS, timeout…) */
  error?: unknown;
  onRetry: () => void;
};

/**
 * Écran d'attente du cours. Sans état d'erreur explicite, un échec réseau
 * (connexion faible) laissait l'apprenant sur "Chargement…" indéfiniment.
 */
export default function CourseLoadState({ isLoading, error, onRetry }: Props) {
  return (
    <div
      className="min-h-screen flex items-center justify-center p-6"
      style={{ background: "var(--st-white)", fontFamily: "'Lexend', ui-sans-serif, system-ui, sans-serif" }}
    >
      {isLoading && !error ? (
        <p className="text-sm text-muted-foreground">Chargement…</p>
      ) : (
        <div className="max-w-sm w-full text-center space-y-4">
          <WifiOff className="w-10 h-10 mx-auto text-muted-foreground" />
          <h2 className="text-lg font-semibold">Impossible de charger la formation</h2>
          <p className="text-sm text-muted-foreground">
            La connexion semble instable ou interrompue. Réessayez : votre progression est
            conservée.
          </p>
          <Button onClick={onRetry} className="w-full">
            Réessayer
          </Button>
        </div>
      )}
    </div>
  );
}
