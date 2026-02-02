import { AlertCircle, Clock, ShieldAlert, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";

interface LoginAttemptFeedbackProps {
  isBlocked: boolean;
  remainingAttempts: number;
  countdown: number;
  formatTimeRemaining: (seconds: number) => string;
  showRemaining: boolean;
}

export default function LoginAttemptFeedback({
  isBlocked,
  remainingAttempts,
  countdown,
  formatTimeRemaining,
  showRemaining,
}: LoginAttemptFeedbackProps) {
  // Si bloqué, afficher le compte à rebours
  if (isBlocked && countdown > 0) {
    return (
      <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 animate-in fade-in slide-in-from-top-2">
        <div className="flex items-start gap-3">
          <ShieldAlert className="h-5 w-5 text-destructive flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="font-medium text-destructive">
              Trop de tentatives de connexion
            </p>
            <p className="text-sm text-muted-foreground mt-1">
              Pour votre sécurité, la connexion est temporairement bloquée.
            </p>
            <div className="flex items-center gap-2 mt-3 text-sm font-medium">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <span>Réessayez dans {formatTimeRemaining(countdown)}</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Afficher le nombre de tentatives restantes après une erreur
  if (showRemaining && remainingAttempts > 0 && remainingAttempts < 5) {
    return (
      <div
        className={cn(
          "rounded-lg border p-3 animate-in fade-in slide-in-from-top-2",
          remainingAttempts <= 2
            ? "border-amber-500/50 bg-amber-500/10"
            : "border-muted bg-muted/50"
        )}
      >
        <div className="flex items-center gap-2">
          {remainingAttempts <= 2 ? (
            <AlertCircle className="h-4 w-4 text-amber-600" />
          ) : (
            <ShieldCheck className="h-4 w-4 text-muted-foreground" />
          )}
          <p className="text-sm">
            {remainingAttempts === 1 ? (
              <span className="text-amber-600 font-medium">
                Dernière tentative avant blocage temporaire
              </span>
            ) : (
              <>
                <span className="font-medium">{remainingAttempts} tentatives</span>{" "}
                <span className="text-muted-foreground">restantes</span>
              </>
            )}
          </p>
        </div>
      </div>
    );
  }

  return null;
}
