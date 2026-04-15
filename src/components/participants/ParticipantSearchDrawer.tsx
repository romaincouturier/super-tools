import { useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Search, GraduationCap, ClipboardCheck, FileText, Star } from "lucide-react";
import { Spinner } from "@/components/ui/spinner";
import { useParticipantHistory } from "@/hooks/useParticipantHistory";

interface ParticipantSearchDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function ParticipantSearchDrawer({ open, onOpenChange }: ParticipantSearchDrawerProps) {
  const [query, setQuery] = useState("");
  const { search, loading, history } = useParticipantHistory();

  const handleSearch = () => {
    if (query.trim()) search(query);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <GraduationCap className="h-5 w-5" />
            Parcours apprenant
          </SheetTitle>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          {/* Search */}
          <div className="flex gap-2">
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              placeholder="Rechercher par email ou nom..."
              className="flex-1"
            />
            <Button onClick={handleSearch} disabled={loading || !query.trim()}>
              {loading ? <Spinner /> : <Search className="h-4 w-4" />}
            </Button>
          </div>

          {/* Results */}
          {history ? (
            <>
              {/* Identity */}
              <div className="bg-muted/50 rounded-lg p-4">
                <div className="font-semibold">{history.name}</div>
                <div className="text-sm text-muted-foreground">{history.email}</div>
                {history.company && (
                  <div className="text-sm text-muted-foreground">{history.company}</div>
                )}
                <div className="mt-2 flex gap-2">
                  <Badge variant="outline">{history.trainings.length} formation{history.trainings.length > 1 ? "s" : ""}</Badge>
                  <Badge variant="outline">{history.evaluations.length} évaluation{history.evaluations.length > 1 ? "s" : ""}</Badge>
                </div>
              </div>

              <Separator />

              {/* Trainings timeline */}
              <div>
                <h3 className="text-sm font-semibold flex items-center gap-2 mb-3">
                  <GraduationCap className="h-4 w-4" />
                  Formations suivies
                </h3>
                {history.trainings.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Aucune formation trouvée</p>
                ) : (
                  <div className="space-y-3">
                    {history.trainings.map((t, i) => (
                      <div key={`${t.training_id}-${i}`} className="border rounded-lg p-3">
                        <div className="font-medium text-sm">{t.training_name}</div>
                        <div className="text-xs text-muted-foreground mt-1 flex gap-3 flex-wrap">
                          {t.start_date && (
                            <span>
                              {new Date(t.start_date).toLocaleDateString("fr-FR")}
                              {t.end_date && ` → ${new Date(t.end_date).toLocaleDateString("fr-FR")}`}
                            </span>
                          )}
                        </div>
                        <div className="flex gap-2 mt-2 flex-wrap">
                          {t.needs_survey_status === "completed" && (
                            <Badge variant="secondary" className="text-[10px]">
                              <ClipboardCheck className="h-3 w-3 mr-1" />
                              Besoins renseignés
                            </Badge>
                          )}
                          {t.needs_survey_status === "sent" && (
                            <Badge variant="outline" className="text-[10px]">Enquête envoyée</Badge>
                          )}
                          {t.signed_convention_url && (
                            <Badge variant="secondary" className="text-[10px]">
                              <FileText className="h-3 w-3 mr-1" />
                              Convention signée
                            </Badge>
                          )}
                          {t.invoice_file_url && (
                            <Badge variant="outline" className="text-[10px]">Facture</Badge>
                          )}
                          {t.elearning_duration != null && t.elearning_duration > 0 && (
                            <Badge variant="outline" className="text-[10px]">{t.elearning_duration}h e-learning</Badge>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Evaluations */}
              {history.evaluations.length > 0 && (
                <>
                  <Separator />
                  <div>
                    <h3 className="text-sm font-semibold flex items-center gap-2 mb-3">
                      <Star className="h-4 w-4" />
                      Évaluations
                    </h3>
                    <div className="space-y-3">
                      {history.evaluations.map((e, i) => (
                        <div key={`${e.training_id}-${i}`} className="border rounded-lg p-3">
                          <div className="font-medium text-sm">{e.training_name}</div>
                          <div className="flex items-center gap-3 mt-1">
                            {e.appreciation_generale != null && (
                              <Badge variant={e.appreciation_generale >= 4 ? "default" : "outline"}>
                                {e.appreciation_generale}/5
                              </Badge>
                            )}
                            {e.date_soumission && (
                              <span className="text-xs text-muted-foreground">
                                {new Date(e.date_soumission).toLocaleDateString("fr-FR")}
                              </span>
                            )}
                            {e.certificate_url && (
                              <Badge variant="secondary" className="text-[10px]">Certificat</Badge>
                            )}
                          </div>
                          {e.commentaire_general && (
                            <p className="text-xs text-muted-foreground mt-2 italic">
                              "{e.commentaire_general}"
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </>
          ) : !loading && query.trim() ? (
            <div className="text-center py-8 text-muted-foreground">
              <GraduationCap className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p>Aucun apprenant trouvé pour "{query}"</p>
              <p className="text-xs mt-1">Essayez avec l'adresse email complète</p>
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <Search className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p>Recherchez un apprenant par email ou nom</p>
              <p className="text-xs mt-1">Le parcours complet sera affiché : formations, besoins, évaluations, documents</p>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
