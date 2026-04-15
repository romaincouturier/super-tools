import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Mail, FileText, ClipboardCheck, ExternalLink, ChevronDown, ChevronUp } from "lucide-react";
import { Spinner } from "@/components/ui/spinner";
import { Button } from "@/components/ui/button";

interface ParticipantTraceabilityDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  participantId: string;
  participantEmail: string;
  participantName: string;
  trainingId: string;
  trainingName: string;
}

interface SentEmail {
  id: string;
  subject: string;
  html_content: string;
  email_type: string | null;
  sent_at: string;
  cc_emails: string[] | null;
  resend_email_id: string | null;
}

interface NeedsSurvey {
  id: string;
  etat: string;
  created_at: string;
  submitted_at: string | null;
  attentes: string | null;
  experience: string | null;
  contraintes: string | null;
  objectif_prioritaire: string | null;
  autres_commentaires: string | null;
  prerequis_data: Record<string, unknown> | null;
}

interface EvaluationData {
  id: string;
  etat: string;
  date_soumission: string | null;
  appreciation_generale: number | null;
  recommandation: string | null;
  message_recommandation: string | null;
  objectifs_evaluation: Record<string, unknown> | null;
  objectif_prioritaire: string | null;
  delai_application: string | null;
  freins_application: string | null;
  rythme: string | null;
  equilibre_theorie_pratique: string | null;
  amelioration_suggeree: string | null;
  conditions_info_satisfaisantes: string | null;
  formation_adaptee_public: string | null;
  qualification_intervenant_adequate: string | null;
  appreciations_prises_en_compte: string | null;
  remarques_libres: string | null;
  certificate_url: string | null;
}

const emailTypeLabels: Record<string, string> = {
  welcome: "Convocation",
  needs_survey: "Recueil des besoins",
  needs_survey_reminder: "Relance recueil",
  evaluation: "Évaluation",
  evaluation_reminder: "Relance évaluation",
  certificate: "Attestation",
  convention: "Convention",
  convention_reminder: "Relance convention",
  attendance_signature: "Émargement",
  thank_you: "Remerciement",
  training_documents: "Documents formation",
  elearning_access: "Accès e-learning",
  booking_reminder: "Rappel réservation",
  accessibility_needs: "Besoins accessibilité",
  prerequis_warning: "Alerte prérequis",
};

const ParticipantTraceabilityDrawer = ({
  open,
  onOpenChange,
  participantId,
  participantEmail,
  participantName,
  trainingId,
  trainingName,
}: ParticipantTraceabilityDrawerProps) => {
  const [emails, setEmails] = useState<SentEmail[]>([]);
  const [needsSurvey, setNeedsSurvey] = useState<NeedsSurvey | null>(null);
  const [evaluation, setEvaluation] = useState<EvaluationData | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandedEmailId, setExpandedEmailId] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    setExpandedEmailId(null);

    const fetchAll = async () => {
      // Fetch sent emails for this participant (by participant_id OR email+training)
      const emailsPromise = supabase
        .from("sent_emails_log")
        .select("id, subject, html_content, email_type, sent_at, cc_emails, resend_email_id")
        .or(`participant_id.eq.${participantId},and(recipient_email.ilike.%${participantEmail}%,training_id.eq.${trainingId})`)
        .order("sent_at", { ascending: false });

      // Fetch needs survey
      const surveyPromise = supabase
        .from("questionnaire_besoins")
        .select("id, etat, created_at, submitted_at, attentes, experience, contraintes, objectif_prioritaire, autres_commentaires, prerequis_data")
        .eq("participant_id", participantId)
        .eq("training_id", trainingId)
        .maybeSingle();

      // Fetch evaluation
      const evalPromise = supabase
        .from("training_evaluations")
        .select(`
          id, etat, date_soumission, appreciation_generale, recommandation,
          message_recommandation, objectifs_evaluation, objectif_prioritaire,
          delai_application, freins_application, rythme, equilibre_theorie_pratique,
          amelioration_suggeree, conditions_info_satisfaisantes, formation_adaptee_public,
          qualification_intervenant_adequate, appreciations_prises_en_compte,
          remarques_libres, certificate_url
        `)
        .eq("participant_id", participantId)
        .eq("training_id", trainingId)
        .maybeSingle();

      const [emailsRes, surveyRes, evalRes] = await Promise.all([
        emailsPromise,
        surveyPromise,
        evalPromise,
      ]);

      setEmails(emailsRes.data || []);
      setNeedsSurvey((surveyRes.data || null) as any);
      setEvaluation((evalRes.data || null) as any);
      setLoading(false);
    };

    fetchAll();
  }, [open, participantId, participantEmail, trainingId]);

  const formatDate = (dateStr: string) =>
    new Date(dateStr).toLocaleDateString("fr-FR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

  const surveyStatusLabel = (etat: string) => {
    const map: Record<string, { label: string; variant: "default" | "secondary" | "outline" | "destructive" }> = {
      non_envoye: { label: "Non envoyé", variant: "secondary" },
      envoye: { label: "Envoyé", variant: "outline" },
      en_cours: { label: "En cours", variant: "outline" },
      complete: { label: "Complété", variant: "default" },
      valide_formateur: { label: "Validé", variant: "default" },
    };
    return map[etat] || { label: etat, variant: "secondary" as const };
  };

  const evalStatusLabel = (etat: string) => {
    const map: Record<string, { label: string; variant: "default" | "secondary" | "outline" }> = {
      non_envoye: { label: "Non envoyée", variant: "secondary" },
      envoye: { label: "Envoyée", variant: "outline" },
      soumis: { label: "Soumise", variant: "default" },
    };
    return map[etat] || { label: etat, variant: "secondary" as const };
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-xl overflow-hidden flex flex-col">
        <SheetHeader>
          <SheetTitle className="text-left">
            Traçabilité — {participantName}
          </SheetTitle>
          <p className="text-sm text-muted-foreground text-left">{trainingName}</p>
        </SheetHeader>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Spinner size="md" className="text-muted-foreground" />
          </div>
        ) : (
          <Tabs defaultValue="emails" className="flex-1 overflow-hidden flex flex-col">
            <TabsList className="w-full grid grid-cols-3">
              <TabsTrigger value="emails" className="gap-1.5">
                <Mail className="h-3.5 w-3.5" />
                Emails ({emails.length})
              </TabsTrigger>
              <TabsTrigger value="besoins" className="gap-1.5">
                <FileText className="h-3.5 w-3.5" />
                Besoins
              </TabsTrigger>
              <TabsTrigger value="evaluation" className="gap-1.5">
                <ClipboardCheck className="h-3.5 w-3.5" />
                Évaluation
              </TabsTrigger>
            </TabsList>

            {/* EMAILS TAB */}
            <TabsContent value="emails" className="flex-1 overflow-hidden mt-4">
              <ScrollArea className="h-full">
                {emails.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">
                    Aucun email enregistré pour ce participant.
                    <br />
                    <span className="text-xs">Les emails envoyés à partir de maintenant seront tracés automatiquement.</span>
                  </p>
                ) : (
                  <div className="space-y-2 pr-4">
                    {emails.map((email) => {
                      const isExpanded = expandedEmailId === email.id;
                      return (
                        <div key={email.id} className="border rounded-lg overflow-hidden">
                          <button
                            className="w-full px-4 py-3 flex items-center gap-3 text-left hover:bg-muted/50 transition-colors"
                            onClick={() => setExpandedEmailId(isExpanded ? null : email.id)}
                          >
                            <Mail className="h-4 w-4 text-muted-foreground shrink-0" />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium truncate">{email.subject}</p>
                              <div className="flex items-center gap-2 mt-0.5">
                                <span className="text-xs text-muted-foreground">{formatDate(email.sent_at)}</span>
                                {email.email_type && (
                                  <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                                    {emailTypeLabels[email.email_type] || email.email_type}
                                  </Badge>
                                )}
                                {email.cc_emails && email.cc_emails.length > 0 && (
                                  <span className="text-[10px] text-muted-foreground">
                                    CC: {email.cc_emails.join(", ")}
                                  </span>
                                )}
                              </div>
                            </div>
                            {isExpanded ? (
                              <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0" />
                            ) : (
                              <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
                            )}
                          </button>
                          {isExpanded && (
                            <div className="border-t px-4 py-3">
                              <div
                                className="prose prose-sm max-w-none text-sm [&_img]:max-w-full [&_table]:text-xs"
                                dangerouslySetInnerHTML={{ __html: email.html_content }}
                              />
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </ScrollArea>
            </TabsContent>

            {/* BESOINS TAB */}
            <TabsContent value="besoins" className="flex-1 overflow-hidden mt-4">
              <ScrollArea className="h-full">
                {!needsSurvey ? (
                  <p className="text-center text-muted-foreground py-8">Aucun recueil des besoins trouvé.</p>
                ) : (
                  <div className="space-y-4 pr-4">
                    <div className="flex items-center gap-2">
                      <Badge variant={surveyStatusLabel(needsSurvey.etat).variant}>
                        {surveyStatusLabel(needsSurvey.etat).label}
                      </Badge>
                      {needsSurvey.submitted_at && (
                        <span className="text-xs text-muted-foreground">
                          Soumis le {formatDate(needsSurvey.submitted_at)}
                        </span>
                      )}
                    </div>

                    {(needsSurvey.etat === "complete" || needsSurvey.etat === "valide_formateur") && (
                      <div className="space-y-3">
                        {needsSurvey.objectif_prioritaire && (
                          <FieldBlock label="Objectif prioritaire" value={needsSurvey.objectif_prioritaire} />
                        )}
                        {needsSurvey.attentes && (
                          <FieldBlock label="Attentes" value={needsSurvey.attentes} />
                        )}
                        {needsSurvey.experience && (
                          <FieldBlock label="Expérience" value={needsSurvey.experience} />
                        )}
                        {needsSurvey.contraintes && (
                          <FieldBlock label="Contraintes" value={needsSurvey.contraintes} />
                        )}
                        {needsSurvey.autres_commentaires && (
                          <FieldBlock label="Commentaires" value={needsSurvey.autres_commentaires} />
                        )}
                        {needsSurvey.prerequis_data && (
                          <div>
                            <p className="text-xs font-medium text-muted-foreground mb-1">Prérequis</p>
                            <pre className="text-sm bg-muted/50 rounded p-3 whitespace-pre-wrap">
                              {typeof needsSurvey.prerequis_data === "string"
                                ? needsSurvey.prerequis_data
                                : JSON.stringify(needsSurvey.prerequis_data, null, 2)}
                            </pre>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </ScrollArea>
            </TabsContent>

            {/* EVALUATION TAB */}
            <TabsContent value="evaluation" className="flex-1 overflow-hidden mt-4">
              <ScrollArea className="h-full">
                {!evaluation ? (
                  <p className="text-center text-muted-foreground py-8">Aucune évaluation trouvée.</p>
                ) : (
                  <div className="space-y-4 pr-4">
                    <div className="flex items-center gap-2">
                      <Badge variant={evalStatusLabel(evaluation.etat).variant}>
                        {evalStatusLabel(evaluation.etat).label}
                      </Badge>
                      {evaluation.date_soumission && (
                        <span className="text-xs text-muted-foreground">
                          Soumise le {formatDate(evaluation.date_soumission)}
                        </span>
                      )}
                      {evaluation.appreciation_generale && (
                        <Badge variant="default" className="gap-1">
                          ⭐ {evaluation.appreciation_generale}/5
                        </Badge>
                      )}
                    </div>

                    {evaluation.certificate_url && (
                      <Button variant="outline" size="sm" className="gap-2" asChild>
                        <a href={evaluation.certificate_url} target="_blank" rel="noopener noreferrer">
                          <ExternalLink className="h-3.5 w-3.5" />
                          Voir l'attestation
                        </a>
                      </Button>
                    )}

                    {evaluation.etat === "soumis" && (
                      <div className="space-y-3">
                        {evaluation.recommandation && (
                          <FieldBlock label="Recommandation" value={evaluation.recommandation} />
                        )}
                        {evaluation.message_recommandation && (
                          <FieldBlock label="Message recommandation" value={evaluation.message_recommandation} />
                        )}
                        {evaluation.objectif_prioritaire && (
                          <FieldBlock label="Objectif prioritaire" value={evaluation.objectif_prioritaire} />
                        )}
                        {evaluation.delai_application && (
                          <FieldBlock label="Délai d'application" value={evaluation.delai_application} />
                        )}
                        {evaluation.freins_application && (
                          <FieldBlock label="Freins à l'application" value={evaluation.freins_application} />
                        )}
                        {evaluation.rythme && (
                          <FieldBlock label="Rythme" value={evaluation.rythme} />
                        )}
                        {evaluation.equilibre_theorie_pratique && (
                          <FieldBlock label="Équilibre théorie/pratique" value={evaluation.equilibre_theorie_pratique} />
                        )}
                        {evaluation.amelioration_suggeree && (
                          <FieldBlock label="Amélioration suggérée" value={evaluation.amelioration_suggeree} />
                        )}
                        {evaluation.conditions_info_satisfaisantes && (
                          <FieldBlock label="Conditions d'information" value={evaluation.conditions_info_satisfaisantes} />
                        )}
                        {evaluation.formation_adaptee_public && (
                          <FieldBlock label="Formation adaptée au public" value={evaluation.formation_adaptee_public} />
                        )}
                        {evaluation.qualification_intervenant_adequate && (
                          <FieldBlock label="Qualification intervenant" value={evaluation.qualification_intervenant_adequate} />
                        )}
                        {evaluation.appreciations_prises_en_compte && (
                          <FieldBlock label="Appréciations prises en compte" value={evaluation.appreciations_prises_en_compte} />
                        )}
                        {evaluation.remarques_libres && (
                          <FieldBlock label="Remarques libres" value={evaluation.remarques_libres} />
                        )}
                        {evaluation.objectifs_evaluation && (
                          <div>
                            <p className="text-xs font-medium text-muted-foreground mb-1">Évaluation des objectifs</p>
                            <pre className="text-sm bg-muted/50 rounded p-3 whitespace-pre-wrap">
                              {typeof evaluation.objectifs_evaluation === "string"
                                ? evaluation.objectifs_evaluation
                                : JSON.stringify(evaluation.objectifs_evaluation, null, 2)}
                            </pre>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </ScrollArea>
            </TabsContent>
          </Tabs>
        )}
      </SheetContent>
    </Sheet>
  );
};

const FieldBlock = ({ label, value }: { label: string; value: string }) => (
  <div>
    <p className="text-xs font-medium text-muted-foreground mb-0.5">{label}</p>
    <p className="text-sm whitespace-pre-wrap">{value}</p>
  </div>
);

export default ParticipantTraceabilityDrawer;
