import { useState } from "react";
import { ChevronDown, ChevronRight, ShieldCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import { useDistanceFollowUp } from "@/hooks/useDistanceFollowUp";
import { FOLLOW_UP_LABELS, type FollowUpStatus } from "@/lib/distanceFollowUp";

/**
 * Effectivité du suivi à distance (indicateur 19 du référentiel qualité).
 *
 * Chaque statut est dépliable sur les faits qui le fondent : c'est ce que le
 * décret appelle vérifier l'effectivité, par opposition à un pourcentage de
 * complétion qu'aucune preuve ne soutient.
 */

const STATUS_STYLE: Record<FollowUpStatus, { variant: "default" | "secondary" | "outline" | "destructive"; className?: string }> = {
  suivi_conforme: { variant: "default" },
  en_cours: { variant: "secondary" },
  a_relancer: { variant: "destructive" },
  incomplet: { variant: "destructive" },
  non_commence: { variant: "outline" },
};

const SUMMARY_ORDER: FollowUpStatus[] = [
  "suivi_conforme",
  "en_cours",
  "a_relancer",
  "incomplet",
  "non_commence",
];

export function DistanceFollowUpTab({ courseId }: { courseId: string }) {
  const { results, summary, mandatoryCount, loading } = useDistanceFollowUp(courseId);
  const [expanded, setExpanded] = useState<string | null>(null);

  if (loading) {
    return <div className="flex justify-center py-12"><Spinner size="md" /></div>;
  }

  return (
    <div className="space-y-5">
      <div className="flex items-start gap-3 rounded-lg border bg-muted/40 p-4">
        <ShieldCheck className="h-5 w-5 shrink-0 text-muted-foreground mt-0.5" />
        <div className="space-y-1 text-sm">
          <p className="font-medium">Effectivité du suivi à distance</p>
          <p className="text-muted-foreground">
            {mandatoryCount > 0
              ? `Parcours attendu : ${mandatoryCount} module${mandatoryCount > 1 ? "s" : ""} obligatoire${mandatoryCount > 1 ? "s" : ""}. Le statut repose sur les modules terminés et les activités rendues, jamais sur le temps de connexion.`
              : "Ce parcours ne comporte aucun module obligatoire : il n'y a pas d'attendu à vérifier, aucun apprenant ne peut être déclaré conforme."}
          </p>
        </div>
      </div>

      {results.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          Aucun apprenant inscrit à ce parcours.
        </div>
      ) : (
        <>
          <div className="flex flex-wrap gap-2">
            {SUMMARY_ORDER.filter((status) => summary[status] > 0).map((status) => (
              <Badge key={status} variant={STATUS_STYLE[status].variant}>
                {summary[status]} {FOLLOW_UP_LABELS[status].toLowerCase()}
              </Badge>
            ))}
          </div>

          <div className="divide-y rounded-lg border">
            {results.map((result) => {
              const isOpen = expanded === result.learnerEmail;
              return (
                <div key={result.learnerEmail}>
                  <button
                    type="button"
                    onClick={() => setExpanded(isOpen ? null : result.learnerEmail)}
                    className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-muted/50 transition-colors"
                    aria-expanded={isOpen}
                  >
                    {isOpen
                      ? <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
                      : <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />}
                    <span className="flex-1 truncate text-sm">{result.learnerEmail}</span>
                    <span className="hidden sm:inline text-xs text-muted-foreground tabular-nums">
                      {result.completed}/{result.expected} modules · {result.activities} activité
                      {result.activities > 1 ? "s" : ""}
                    </span>
                    <Badge variant={STATUS_STYLE[result.status].variant}>
                      {FOLLOW_UP_LABELS[result.status]}
                    </Badge>
                  </button>

                  {isOpen && (
                    <div className="space-y-2 border-t bg-muted/30 px-4 py-3 pl-11 text-sm">
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">
                        Faits retenus
                      </p>
                      <ul className="list-disc space-y-1 pl-4 text-muted-foreground">
                        {result.reasons.map((reason) => (
                          <li key={reason}>{reason}</li>
                        ))}
                        <li>
                          {result.opened} module{result.opened > 1 ? "s" : ""} ouvert
                          {result.opened > 1 ? "s" : ""} au moins une fois.
                        </li>
                        <li>
                          {result.lastActivityAt
                            ? `Dernière activité le ${new Date(result.lastActivityAt).toLocaleDateString("fr-FR")}.`
                            : "Aucune activité pédagogique enregistrée."}
                        </li>
                      </ul>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

export default DistanceFollowUpTab;
