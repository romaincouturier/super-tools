import { useState } from "react";
import { Eye, User, Briefcase, BookOpen, Target, MessageSquare, Accessibility, Download } from "lucide-react";
import { Spinner } from "@/components/ui/spinner";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { format, parseISO } from "date-fns";
import { fr } from "date-fns/locale";
import { jsPDF } from "jspdf";
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
        .in("etat", ["complete", "valide_formateur"])
        .order("date_soumission", { ascending: false })
        .limit(1)
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

  const exportToPdf = () => {
    if (!questionnaire) return;

    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 20;
    const maxWidth = pageWidth - margin * 2;
    let y = 20;

    const checkPageBreak = (needed: number) => {
      if (y + needed > doc.internal.pageSize.getHeight() - 20) {
        doc.addPage();
        y = 20;
      }
    };

    const addTitle = (text: string) => {
      checkPageBreak(16);
      doc.setFontSize(12);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(33, 33, 33);
      doc.text(text, margin, y);
      y += 8;
    };

    const addField = (label: string, value: string | null | undefined) => {
      if (!value) return;
      checkPageBreak(12);
      doc.setFontSize(9);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(100, 100, 100);
      doc.text(`${label} :`, margin + 2, y);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(33, 33, 33);
      const labelWidth = doc.getTextWidth(`${label} : `);
      const lines = doc.splitTextToSize(value, maxWidth - labelWidth - 4);
      if (lines.length === 1) {
        doc.text(value, margin + 2 + labelWidth, y);
        y += 6;
      } else {
        y += 5;
        const wrappedLines = doc.splitTextToSize(value, maxWidth - 4);
        doc.text(wrappedLines, margin + 4, y);
        y += wrappedLines.length * 4.5 + 2;
      }
    };

    const addLevel = (label: string, value: number | null) => {
      if (value === null) return;
      checkPageBreak(10);
      doc.setFontSize(9);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(100, 100, 100);
      doc.text(`${label} :`, margin + 2, y);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(33, 33, 33);
      const dots = "●".repeat(value) + "○".repeat(5 - value);
      doc.text(`${dots} ${value}/5`, margin + 2 + doc.getTextWidth(`${label} : `), y);
      y += 6;
    };

    const addSeparator = () => {
      checkPageBreak(8);
      doc.setDrawColor(220, 220, 220);
      doc.line(margin, y, pageWidth - margin, y);
      y += 6;
    };

    // Header
    doc.setFontSize(16);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(33, 33, 33);
    doc.text("Recueil des besoins", margin, y);
    y += 8;
    doc.setFontSize(11);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(80, 80, 80);
    doc.text(participantName, margin, y);
    y += 6;

    if (questionnaire.date_soumission) {
      doc.setFontSize(9);
      doc.text(
        `Soumis le ${format(parseISO(questionnaire.date_soumission), "d MMMM yyyy 'à' HH:mm", { locale: fr })}`,
        margin, y
      );
      y += 4;
    }
    y += 6;

    // Section 1: Identification
    addTitle("Identification");
    addField("Nom", questionnaire.nom);
    addField("Prénom", questionnaire.prenom);
    addField("Email", questionnaire.email);
    addField("Société", questionnaire.societe);
    addField("Fonction", questionnaire.fonction);
    addSeparator();

    // Section 2: Experience
    addTitle("Expérience et prérequis");
    addField("Expérience sur le sujet", getExperienceLabel(questionnaire.experience_sujet));
    addField("Détails de l'expérience", questionnaire.experience_details);
    addField("Lecture du programme", getLectureProgrammeLabel(questionnaire.lecture_programme));

    if (questionnaire.prerequis_validation) {
      try {
        const parsed = JSON.parse(questionnaire.prerequis_validation);
        if (typeof parsed === 'object' && !Array.isArray(parsed)) {
          Object.entries(parsed as Record<string, string>).forEach(([prereq, status]) => {
            const statusLabel = status === "oui" ? "✓ Validé" : status === "partiellement" ? "⚠ Partiellement" : "✗ Non validé";
            addField(prereq, statusLabel);
          });
        }
      } catch {
        addField("Validation des prérequis", getPrerequisLabel(questionnaire.prerequis_validation));
      }
    }
    if (questionnaire.prerequis_details) {
      addField("Précisions sur les prérequis", questionnaire.prerequis_details);
    }
    addSeparator();

    // Section 3: Objectives
    addTitle("Objectifs et motivation");
    addLevel("Niveau actuel estimé", questionnaire.niveau_actuel);
    addLevel("Niveau de motivation", questionnaire.niveau_motivation);
    addField("Compétences actuelles", questionnaire.competences_actuelles);
    addField("Compétences visées", questionnaire.competences_visees);
    addField("Lien avec la mission professionnelle", questionnaire.lien_mission);
    addSeparator();

    // Section 4: Constraints
    if (questionnaire.contraintes_orga) {
      addTitle("Contraintes organisationnelles");
      addField("Contraintes", questionnaire.contraintes_orga);
      addSeparator();
    }

    // Section 5: Accessibility
    if (questionnaire.necessite_amenagement || questionnaire.besoins_accessibilite) {
      addTitle("Besoins d'accessibilité");
      if (questionnaire.necessite_amenagement) {
        addField("Aménagement", "Nécessaire");
      }
      addField("Besoins spécifiques", questionnaire.besoins_accessibilite);
      addSeparator();
    }

    // Section 6: Comments
    if (questionnaire.commentaires_libres) {
      addTitle("Commentaires libres");
      addField("Commentaires", questionnaire.commentaires_libres);
    }

    // Footer on each page
    const pageCount = doc.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setTextColor(150, 150, 150);
      doc.text(`Page ${i}/${pageCount}`, pageWidth - margin, doc.internal.pageSize.getHeight() - 10, { align: "right" });
    }

    const safeName = participantName.replace(/[^a-zA-Z0-9À-ÿ\s-]/g, "").replace(/\s+/g, "_");
    doc.save(`Recueil_besoins_${safeName}.pdf`);
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
          <p>Recueil des besoins</p>
        </TooltipContent>
      </Tooltip>
      <DialogContent className="w-full sm:max-w-2xl max-h-[85vh]">
        <DialogHeader className="flex flex-row items-center justify-between gap-2">
          <DialogTitle>Recueil des besoins - {participantName}</DialogTitle>
          {questionnaire && (
            <Button variant="outline" size="sm" onClick={exportToPdf} className="shrink-0">
              <Download className="h-4 w-4 mr-1" />
              PDF
            </Button>
          )}
        </DialogHeader>
        
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Spinner size="lg" className="text-primary" />
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
