import { useState } from "react";
import { Eye, Loader2, User, Briefcase, BookOpen, Target, MessageSquare, Accessibility } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { format, parseISO } from "date-fns";
import { fr } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";

interface QuestionnaireData {
  id: string;
  email: string | null;
  nom: string | null;
  prenom: string | null;
  societe: string | null;
  fonction: string | null;
  experience_sujet: string | null;
  experience_details: string | null;
  lecture_programme: string | null;
  prerequis_validation: string | null;
  prerequis_details: string | null;
  competences_actuelles: string | null;
  competences_visees: string | null;
  lien_mission: string | null;
  niveau_actuel: number | null;
  niveau_motivation: number | null;
  modalites_preferences: string[] | null;
  besoins_accessibilite: string | null;
  contraintes_orga: string | null;
  commentaires_libres: string | null;
  date_soumission: string | null;
  necessite_amenagement: boolean | null;
}

interface ViewQuestionnaireDialogProps {
  participantId: string;
  participantName: string;
  trainingId: string;
}

const Section = ({ icon: Icon, title, children }: { icon: React.ComponentType<{ className?: string }>; title: string; children: React.ReactNode }) => (
  <div className="space-y-3">
    <div className="flex items-center gap-2 text-sm font-medium">
      <Icon className="h-4 w-4 text-primary" />
      {title}
    </div>
    <div className="pl-6 space-y-2">
      {children}
    </div>
  </div>
);

const Field = ({ label, value }: { label: string; value: string | null | undefined }) => {
  if (!value) return null;
  return (
    <div className="text-sm">
      <span className="text-muted-foreground">{label} :</span>{" "}
      <span className="font-medium">{value}</span>
    </div>
  );
};

const LevelIndicator = ({ label, value }: { label: string; value: number | null }) => {
  if (value === null) return null;
  return (
    <div className="flex items-center gap-2 text-sm">
      <span className="text-muted-foreground">{label} :</span>
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map((level) => (
          <div
            key={level}
            className={`w-4 h-4 rounded-full border ${
              level <= value
                ? "bg-primary border-primary"
                : "bg-muted border-border"
            }`}
          />
        ))}
      </div>
      <span className="font-medium">{value}/5</span>
    </div>
  );
};

const ViewQuestionnaireDialog = ({ participantId, participantName, trainingId }: ViewQuestionnaireDialogProps) => {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [questionnaire, setQuestionnaire] = useState<QuestionnaireData | null>(null);
  const { toast } = useToast();

  const fetchQuestionnaire = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("questionnaire_besoins")
        .select("*")
        .eq("participant_id", participantId)
        .eq("training_id", trainingId)
        .maybeSingle();

      if (error) throw error;

      if (!data) {
        toast({
          title: "Questionnaire non trouvé",
          description: "Aucun questionnaire n'a été trouvé pour ce participant.",
          variant: "destructive",
        });
        setOpen(false);
        return;
      }

      setQuestionnaire(data as QuestionnaireData);
    } catch (error: unknown) {
      console.error("Error fetching questionnaire:", error);
      toast({
        title: "Erreur",
        description: "Impossible de charger le questionnaire.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleOpenChange = (isOpen: boolean) => {
    setOpen(isOpen);
    if (isOpen) {
      fetchQuestionnaire();
    } else {
      setQuestionnaire(null);
    }
  };

  const getExperienceLabel = (value: string | null) => {
    switch (value) {
      case "aucune": return "Aucune expérience";
      case "courte": return "Expérience courte (moins de 6 mois)";
      case "longue": return "Expérience longue (plus de 6 mois)";
      case "certification": return "Expérience avec certification";
      default: return value;
    }
  };

  const getLectureProgrammeLabel = (value: string | null) => {
    switch (value) {
      case "complete": return "Oui, en entier";
      case "partielle": return "Partiellement";
      case "non": return "Non";
      default: return value;
    }
  };

  const getPrerequisLabel = (value: string | null) => {
    switch (value) {
      case "oui": return "Oui, je valide";
      case "partiellement": return "Partiellement";
      case "non": return "Non";
      default: return value;
    }
  };

  const formatPrerequisValidations = (validations: unknown): React.ReactNode => {
    if (!validations) return null;
    
    // Handle object format (prerequis name -> validation status)
    if (typeof validations === 'object' && !Array.isArray(validations)) {
      const entries = Object.entries(validations as Record<string, string>);
      if (entries.length === 0) return null;
      
      const getValidationLabel = (val: string) => {
        switch (val) {
          case "oui": return "✓ Validé";
          case "partiellement": return "⚠️ Partiellement";
          case "non": return "✗ Non validé";
          default: return val;
        }
      };
      
      return (
        <div className="space-y-1">
          {entries.map(([prereq, status]) => (
            <div key={prereq} className="text-sm flex justify-between gap-2">
              <span className="text-muted-foreground">{prereq}</span>
              <span className="font-medium">{getValidationLabel(status)}</span>
            </div>
          ))}
        </div>
      );
    }
    
    return null;
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <Tooltip>
        <TooltipTrigger asChild>
          <DialogTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-muted-foreground hover:text-primary"
            >
              <Eye className="h-4 w-4" />
            </Button>
          </DialogTrigger>
        </TooltipTrigger>
        <TooltipContent>
          <p>Voir les réponses</p>
        </TooltipContent>
      </Tooltip>
      <DialogContent className="max-w-2xl max-h-[85vh]">
        <DialogHeader>
          <DialogTitle>Recueil des besoins - {participantName}</DialogTitle>
        </DialogHeader>
        
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : questionnaire ? (
          <ScrollArea className="max-h-[calc(85vh-120px)] pr-4">
            <div className="space-y-6">
              {/* Submission date */}
              {questionnaire.date_soumission && (
                <Badge variant="outline" className="text-xs">
                  Soumis le {format(parseISO(questionnaire.date_soumission), "d MMMM yyyy 'à' HH:mm", { locale: fr })}
                </Badge>
              )}

              {/* Section 1: Identification */}
              <Section icon={User} title="Identification">
                <Field label="Nom" value={questionnaire.nom} />
                <Field label="Prénom" value={questionnaire.prenom} />
                <Field label="Email" value={questionnaire.email} />
                <Field label="Société" value={questionnaire.societe} />
                <Field label="Fonction" value={questionnaire.fonction} />
              </Section>

              <Separator />

              {/* Section 2: Experience */}
              <Section icon={Briefcase} title="Expérience et prérequis">
                <Field label="Expérience sur le sujet" value={getExperienceLabel(questionnaire.experience_sujet)} />
                <Field label="Détails de l'expérience" value={questionnaire.experience_details} />
                <Field label="Lecture du programme" value={getLectureProgrammeLabel(questionnaire.lecture_programme)} />
                
                {/* Display individual prerequisite validations */}
                {questionnaire.prerequis_validation && (() => {
                  try {
                    const parsed = JSON.parse(questionnaire.prerequis_validation);
                    if (typeof parsed === 'object' && !Array.isArray(parsed) && Object.keys(parsed).length > 0) {
                      return (
                        <div className="space-y-2">
                          <span className="text-sm text-muted-foreground">Validation des prérequis :</span>
                          {formatPrerequisValidations(parsed)}
                        </div>
                      );
                    }
                  } catch {
                    // If it's not JSON, display as simple text
                    return <Field label="Validation des prérequis" value={getPrerequisLabel(questionnaire.prerequis_validation)} />;
                  }
                  return null;
                })()}
                
                {questionnaire.prerequis_details && (
                  <div className="text-sm p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-md">
                    <span className="text-amber-800 dark:text-amber-200 font-medium">⚠️ Précisions sur les prérequis :</span>
                    <p className="mt-1 text-amber-700 dark:text-amber-300">{questionnaire.prerequis_details}</p>
                  </div>
                )}
              </Section>

              <Separator />

              {/* Section 3: Objectives & Motivation */}
              <Section icon={Target} title="Objectifs et motivation">
                <LevelIndicator label="Niveau actuel estimé" value={questionnaire.niveau_actuel} />
                <LevelIndicator label="Niveau de motivation" value={questionnaire.niveau_motivation} />
                <Field label="Compétences actuelles" value={questionnaire.competences_actuelles} />
                <Field label="Compétences visées" value={questionnaire.competences_visees} />
                <Field label="Lien avec la mission professionnelle" value={questionnaire.lien_mission} />
              </Section>

              <Separator />

              {/* Section 4: Organizational constraints */}
              {questionnaire.contraintes_orga && (
                <Section icon={BookOpen} title="Contraintes organisationnelles">
                  <p className="text-sm">{questionnaire.contraintes_orga}</p>
                </Section>
              )}

              {/* Section 5: Accessibility - only if relevant */}
              {(questionnaire.necessite_amenagement || questionnaire.besoins_accessibilite) && (
                <>
                  <Separator />
                  <Section icon={Accessibility} title="Besoins d'accessibilité">
                    {questionnaire.necessite_amenagement && (
                      <Badge variant="secondary" className="mb-2">
                        Aménagement nécessaire
                      </Badge>
                    )}
                    <Field label="Besoins spécifiques" value={questionnaire.besoins_accessibilite} />
                  </Section>
                </>
              )}

              {/* Section 6: Comments */}
              {questionnaire.commentaires_libres && (
                <>
                  <Separator />
                  <Section icon={MessageSquare} title="Commentaires libres">
                    <p className="text-sm text-foreground whitespace-pre-wrap">
                      {questionnaire.commentaires_libres}
                    </p>
                  </Section>
                </>
              )}
            </div>
          </ScrollArea>
        ) : (
          <div className="text-center py-12 text-muted-foreground">
            Aucune donnée disponible
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default ViewQuestionnaireDialog;
