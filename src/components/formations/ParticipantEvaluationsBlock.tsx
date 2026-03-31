import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Star, ClipboardCheck, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

interface Props {
  trainingId: string;
}

interface ParticipantEval {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string;
  etat: string | null;
  appreciation_generale: number | null;
  recommandation: string | null;
  objectif_prioritaire: string | null;
  rythme: string | null;
  equilibre_theorie_pratique: string | null;
  amelioration_suggeree: string | null;
  remarques_libres: string | null;
  date_soumission: string | null;
}

const ParticipantEvaluationsBlock = ({ trainingId }: Props) => {
  const [evaluations, setEvaluations] = useState<ParticipantEval[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const fetch = async () => {
      const { data } = await supabase
        .from("training_evaluations")
        .select("id, first_name, last_name, email, etat, appreciation_generale, recommandation, objectif_prioritaire, rythme, equilibre_theorie_pratique, amelioration_suggeree, remarques_libres, date_soumission")
        .eq("training_id", trainingId)
        .order("date_soumission", { ascending: false, nullsFirst: false });
      setEvaluations(data || []);
      setLoading(false);
    };
    fetch();
  }, [trainingId]);

  if (loading) return null;

  const submitted = evaluations.filter(e => e.etat === "soumis");
  const pending = evaluations.filter(e => e.etat !== "soumis");
  const avgScore = submitted.length > 0
    ? (submitted.reduce((sum, e) => sum + (e.appreciation_generale || 0), 0) / submitted.length).toFixed(1)
    : null;

  return (
    <Card>
      <Collapsible open={open} onOpenChange={setOpen}>
        <CardHeader className="pb-3">
          <CollapsibleTrigger asChild>
            <button className="flex items-center justify-between w-full text-left">
              <CardTitle className="flex items-center gap-2 text-base">
                <ClipboardCheck className="h-5 w-5" />
                Évaluations participants
                <Badge variant="secondary" className="ml-1">{submitted.length}/{evaluations.length}</Badge>
                {avgScore && (
                  <span className="flex items-center gap-1 text-sm font-normal text-muted-foreground">
                    <Star className="h-3.5 w-3.5 fill-primary text-primary" />
                    {avgScore}/5
                  </span>
                )}
              </CardTitle>
              {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
            </button>
          </CollapsibleTrigger>
        </CardHeader>
        <CollapsibleContent>
          <CardContent className="pt-0 space-y-3">
            {evaluations.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-2">Aucune évaluation participant.</p>
            ) : (
              <div className="space-y-2">
                {evaluations.map(ev => {
                  const name = [ev.first_name, ev.last_name].filter(Boolean).join(" ") || ev.email;
                  const isSubmitted = ev.etat === "soumis";
                  return (
                    <div key={ev.id} className="border rounded-lg p-3 space-y-1.5">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-medium text-sm">{name}</span>
                        <Badge variant={isSubmitted ? "default" : "outline"}>
                          {isSubmitted ? "Soumis" : ev.etat === "envoye" ? "Envoyé" : "Non envoyé"}
                        </Badge>
                      </div>
                      {isSubmitted && (
                        <div className="space-y-1 text-sm">
                          <div className="flex items-center gap-1">
                            {[1, 2, 3, 4, 5].map(v => (
                              <Star key={v} className={`h-3.5 w-3.5 ${v <= (ev.appreciation_generale || 0) ? "fill-primary text-primary" : "text-muted-foreground/30"}`} />
                            ))}
                            <span className="ml-1 text-muted-foreground">{ev.appreciation_generale}/5</span>
                            {ev.recommandation && (
                              <span className="ml-2 text-muted-foreground">· {ev.recommandation}</span>
                            )}
                          </div>
                          {ev.rythme && <p className="text-muted-foreground"><strong>Rythme :</strong> {ev.rythme}</p>}
                          {ev.equilibre_theorie_pratique && <p className="text-muted-foreground"><strong>Équilibre :</strong> {ev.equilibre_theorie_pratique}</p>}
                          {ev.amelioration_suggeree && <p className="text-muted-foreground"><strong>Amélioration :</strong> {ev.amelioration_suggeree}</p>}
                          {ev.remarques_libres && <p className="text-muted-foreground"><strong>Remarques :</strong> {ev.remarques_libres}</p>}
                          {ev.date_soumission && (
                            <p className="text-xs text-muted-foreground/70">
                              Soumis le {new Date(ev.date_soumission).toLocaleDateString("fr-FR")}
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
};

export default ParticipantEvaluationsBlock;
