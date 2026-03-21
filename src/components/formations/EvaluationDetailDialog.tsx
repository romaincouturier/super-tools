import { Star } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  type EvaluationData,
  getRecommandationLabel,
  getRecommandationVariant,
  getDelaiApplicationLabel,
  getRythmeLabel,
  getEquilibreLabel,
  getAppreciationsLabel,
  formatEvaluationDisplayName,
} from "@/lib/evaluationUtils";

// Re-export for consumers that import from this file
export type { EvaluationData };

interface EvaluationDetailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  evaluation: EvaluationData | null;
  trainingName?: string;
}

const getStars = (rating: number | null) => {
  if (!rating) return null;
  return Array.from({ length: 5 }, (_, i) => (
    <Star
      key={i}
      className={`h-4 w-4 ${i < rating ? "fill-yellow-400 text-yellow-400" : "text-muted-foreground"}`}
    />
  ));
};

const RecommandationBadge = ({ recommandation }: { recommandation: string | null }) => {
  const label = getRecommandationLabel(recommandation);
  if (!label) return null;
  return (
    <Badge variant={getRecommandationVariant(recommandation)}>
      {label}
    </Badge>
  );
};

const BoolBadge = ({ value }: { value: boolean | null }) => {
  if (value === true) return <Badge variant="default" className="bg-green-600">Oui</Badge>;
  if (value === false) return <Badge variant="destructive">Non</Badge>;
  return <span>—</span>;
};

const EvaluationDetailDialog = ({
  open,
  onOpenChange,
  evaluation,
  trainingName,
}: EvaluationDetailDialogProps) => {
  if (!evaluation) return null;

  const displayName = formatEvaluationDisplayName(
    evaluation.first_name,
    evaluation.last_name,
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-full sm:max-w-3xl max-h-[85vh]">
        <DialogHeader>
          <DialogTitle>Détail de l'évaluation</DialogTitle>
          <DialogDescription>
            {displayName}
            {evaluation.company && ` - ${evaluation.company}`}
            {trainingName && ` • ${trainingName}`}
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[65vh] pr-4">
          <div className="space-y-6">
            {/* Informations participant */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 bg-muted/50 rounded-lg">
              <div>
                <span className="text-sm text-muted-foreground">Email</span>
                <p className="font-medium">{evaluation.email || "—"}</p>
              </div>
              <div>
                <span className="text-sm text-muted-foreground">Date de soumission</span>
                <p className="font-medium">
                  {evaluation.date_soumission
                    ? new Date(evaluation.date_soumission).toLocaleDateString("fr-FR", {
                        day: "numeric",
                        month: "long",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })
                    : "—"}
                </p>
              </div>
            </div>

            {/* Appréciation générale */}
            <div>
              <h3 className="font-semibold mb-2">Appréciation générale</h3>
              <div className="flex items-center gap-4">
                <div className="flex">{getStars(evaluation.appreciation_generale)}</div>
                <span className="text-lg font-bold">{evaluation.appreciation_generale}/5</span>
                <RecommandationBadge recommandation={evaluation.recommandation} />
              </div>
            </div>

            {/* Objectifs pédagogiques */}
            {evaluation.objectifs_evaluation && evaluation.objectifs_evaluation.length > 0 && (
              <div>
                <h3 className="font-semibold mb-2">Atteinte des objectifs pédagogiques</h3>
                <div className="space-y-2">
                  {evaluation.objectifs_evaluation.map((obj, idx) => (
                    <div key={idx} className="flex items-center justify-between p-2 border rounded">
                      <span className="text-sm flex-1">{obj.objectif}</span>
                      <div className="flex items-center gap-2">
                        <div className="flex">
                          {Array.from({ length: 5 }, (_, i) => (
                            <Star
                              key={i}
                              className={`h-3 w-3 ${i < obj.niveau ? "fill-yellow-400 text-yellow-400" : "text-muted-foreground"}`}
                            />
                          ))}
                        </div>
                        <span className="text-sm font-medium w-8">{obj.niveau}/5</span>
                      </div>
                    </div>
                  ))}
                </div>
                {evaluation.objectif_prioritaire && (
                  <p className="text-sm mt-2">
                    <span className="text-muted-foreground">Objectif prioritaire :</span>{" "}
                    <span className="font-medium">{evaluation.objectif_prioritaire}</span>
                  </p>
                )}
              </div>
            )}

            {/* Application pratique */}
            <div>
              <h3 className="font-semibold mb-2">Application pratique</h3>
              <div className="grid grid-cols-1 gap-2">
                {evaluation.delai_application && (
                  <p className="text-sm">
                    <span className="text-muted-foreground">Délai d'application :</span>{" "}
                    <Badge variant="outline">
                      {getDelaiApplicationLabel(evaluation.delai_application)}
                    </Badge>
                  </p>
                )}
                {evaluation.freins_application && (
                  <p className="text-sm">
                    <span className="text-muted-foreground">Freins à l'application :</span>{" "}
                    <span className="italic">"{evaluation.freins_application}"</span>
                  </p>
                )}
              </div>
            </div>

            {/* Qualité pédagogique */}
            <div>
              <h3 className="font-semibold mb-2">Qualité pédagogique</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {evaluation.rythme && (
                  <p className="text-sm">
                    <span className="text-muted-foreground">Rythme :</span>{" "}
                    <Badge variant={evaluation.rythme === "adapte" ? "default" : "secondary"}>
                      {getRythmeLabel(evaluation.rythme)}
                    </Badge>
                  </p>
                )}
                {evaluation.equilibre_theorie_pratique && (
                  <p className="text-sm">
                    <span className="text-muted-foreground">Équilibre théorie/pratique :</span>{" "}
                    <Badge variant={evaluation.equilibre_theorie_pratique === "equilibre" ? "default" : "secondary"}>
                      {getEquilibreLabel(evaluation.equilibre_theorie_pratique)}
                    </Badge>
                  </p>
                )}
              </div>
              {evaluation.amelioration_suggeree && (
                <p className="text-sm mt-2">
                  <span className="text-muted-foreground">Amélioration suggérée :</span>{" "}
                  <span className="italic">"{evaluation.amelioration_suggeree}"</span>
                </p>
              )}
            </div>

            {/* Conformité Qualiopi */}
            <div>
              <h3 className="font-semibold mb-2">Conformité et organisation</h3>
              <div className="grid grid-cols-1 gap-2">
                <p className="text-sm flex items-center gap-2">
                  <span className="text-muted-foreground">Conditions d'information satisfaisantes :</span>
                  <BoolBadge value={evaluation.conditions_info_satisfaisantes} />
                </p>
                <p className="text-sm flex items-center gap-2">
                  <span className="text-muted-foreground">Formation adaptée au public :</span>
                  <BoolBadge value={evaluation.formation_adaptee_public} />
                </p>
                <p className="text-sm flex items-center gap-2">
                  <span className="text-muted-foreground">Qualification intervenant adéquate :</span>
                  <BoolBadge value={evaluation.qualification_intervenant_adequate} />
                </p>
                {evaluation.appreciations_prises_en_compte && (
                  <p className="text-sm flex items-center gap-2">
                    <span className="text-muted-foreground">Appréciations prises en compte :</span>
                    <Badge variant="outline">
                      {getAppreciationsLabel(evaluation.appreciations_prises_en_compte)}
                    </Badge>
                  </p>
                )}
              </div>
            </div>

            {/* Témoignage */}
            {evaluation.message_recommandation && (
              <div>
                <h3 className="font-semibold mb-2">Témoignage</h3>
                <blockquote className="border-l-4 border-primary pl-4 italic text-muted-foreground">
                  "{evaluation.message_recommandation}"
                </blockquote>
                {evaluation.consent_publication !== null && (
                  <p className="text-xs mt-2 text-muted-foreground">
                    {evaluation.consent_publication
                      ? "Consent à la publication"
                      : "Ne consent pas à la publication"}
                  </p>
                )}
              </div>
            )}

            {/* Remarques libres */}
            {evaluation.remarques_libres && (
              <div>
                <h3 className="font-semibold mb-2">Remarques libres</h3>
                <p className="text-sm italic text-muted-foreground">
                  "{evaluation.remarques_libres}"
                </p>
              </div>
            )}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
};

export default EvaluationDetailDialog;
