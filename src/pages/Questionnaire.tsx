import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Slider } from "@/components/ui/slider";
import { Loader2, ExternalLink, Calendar, Clock, CheckCircle2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import supertiltLogo from "@/assets/supertilt-logo-anthracite-transparent.png";

type QuestionnaireRecord = {
  id: string;
  training_id: string;
  participant_id: string;
  token: string;
  etat: string;
  email: string | null;
  prenom: string | null;
  nom: string | null;
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
  modalites_preferences: Record<string, string> | null;
  contraintes_orga: string | null;
  besoins_accessibilite: string | null;
  necessite_amenagement: boolean | null;
  commentaires_libres: string | null;
  consentement_rgpd: boolean;
  date_premiere_ouverture: string | null;
  date_derniere_sauvegarde: string | null;
  date_soumission: string | null;
  date_consentement_rgpd: string | null;
};

type TrainingRecord = {
  training_name: string;
  start_date: string;
  end_date: string | null;
  prerequisites: string[] | null;
  program_file_url: string | null;
  format_formation: string | null;
};

type ScheduleRecord = {
  day_date: string;
  start_time: string;
  end_time: string;
};

const Questionnaire = () => {
  const { token } = useParams<{ token: string }>();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [questionnaire, setQuestionnaire] = useState<QuestionnaireRecord | null>(null);
  const [training, setTraining] = useState<TrainingRecord | null>(null);
  const [schedules, setSchedules] = useState<ScheduleRecord[]>([]);
  const [prerequisValidations, setPrerequisValidations] = useState<Record<string, string>>({});
  const [editingAfterSubmit, setEditingAfterSubmit] = useState(false);

  const dirtyRef = useRef(false);
  const autosaveTimerRef = useRef<number | null>(null);

  const displayName = useMemo(() => {
    if (!questionnaire) return "";
    const parts = [questionnaire.prenom, questionnaire.nom].filter(Boolean);
    return parts.join(" ").trim();
  }, [questionnaire]);

  const isInterEntreprises = training?.format_formation === "inter";

  const markDirty = () => {
    dirtyRef.current = true;
  };

  const insertEvent = async (questionnaireId: string, type_evenement: string, metadata?: Record<string, unknown>) => {
    try {
      await supabase.from("questionnaire_events").insert([
        {
          questionnaire_id: questionnaireId,
          type_evenement,
          metadata: (metadata ?? {}) as any,
        },
      ]);
    } catch (e) {
      console.warn("Failed to insert questionnaire event", e);
    }
  };

  const fetchData = async () => {
    if (!token) {
      setError("Lien invalide : token manquant.");
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const { data: q, error: qErr } = await supabase
        .from("questionnaire_besoins")
        .select("*")
        .eq("token", token)
        .single();

      if (qErr || !q) {
        throw qErr || new Error("Questionnaire introuvable");
      }

      const qTyped = q as unknown as QuestionnaireRecord;
      setQuestionnaire(qTyped);

      // Parse existing prerequis validations
      if (qTyped.modalites_preferences) {
        setPrerequisValidations(qTyped.modalites_preferences as Record<string, string>);
      }

      const { data: t, error: tErr } = await supabase
        .from("trainings")
        .select("training_name,start_date,end_date,prerequisites,program_file_url,format_formation")
        .eq("id", qTyped.training_id)
        .single();

      if (!tErr && t) {
        setTraining(t as unknown as TrainingRecord);
        
        // Initialize prerequis validations for all prerequisites
        if (t.prerequisites && Array.isArray(t.prerequisites)) {
          const existingValidations = qTyped.modalites_preferences as Record<string, string> || {};
          const newValidations: Record<string, string> = {};
          t.prerequisites.forEach((prereq: string) => {
            newValidations[prereq] = existingValidations[prereq] || "";
          });
          setPrerequisValidations(newValidations);
        }
      }

      // Fetch schedules
      const { data: sched, error: schedErr } = await supabase
        .from("training_schedules")
        .select("day_date, start_time, end_time")
        .eq("training_id", qTyped.training_id)
        .order("day_date", { ascending: true });

      if (!schedErr && sched) {
        setSchedules(sched as ScheduleRecord[]);
      }

      // First open tracking
      if (!qTyped.date_premiere_ouverture) {
        const nowIso = new Date().toISOString();
        await supabase
          .from("questionnaire_besoins")
          .update({
            date_premiere_ouverture: nowIso,
            etat: qTyped.etat === "envoye" ? "accueil_envoye" : qTyped.etat,
          })
          .eq("id", qTyped.id);
        await insertEvent(qTyped.id, "opened", { source: "public_link" });
      }
    } catch (e: any) {
      console.error("Failed to load questionnaire", e);
      setError(
        "Impossible d'ouvrir ce questionnaire (lien invalide, expiré, ou accès refusé)."
      );
    } finally {
      setLoading(false);
    }
  };

  const saveDraft = async (opts?: { silent?: boolean }) => {
    if (!questionnaire) return;
    if (!dirtyRef.current) return;

    const nowIso = new Date().toISOString();
    setSaving(true);
    try {
      const payload = {
        prenom: questionnaire.prenom,
        nom: questionnaire.nom,
        societe: questionnaire.societe,
        fonction: questionnaire.fonction,
        experience_sujet: questionnaire.experience_sujet,
        experience_details: questionnaire.experience_details,
        lecture_programme: questionnaire.lecture_programme,
        prerequis_validation: questionnaire.prerequis_validation,
        prerequis_details: questionnaire.prerequis_details,
        competences_actuelles: questionnaire.competences_actuelles,
        competences_visees: questionnaire.competences_visees,
        lien_mission: questionnaire.lien_mission,
        niveau_actuel: questionnaire.niveau_actuel,
        niveau_motivation: questionnaire.niveau_motivation,
        modalites_preferences: prerequisValidations as any,
        contraintes_orga: questionnaire.contraintes_orga,
        besoins_accessibilite: questionnaire.besoins_accessibilite,
        necessite_amenagement: questionnaire.necessite_amenagement,
        commentaires_libres: questionnaire.commentaires_libres,
        consentement_rgpd: questionnaire.consentement_rgpd,
        date_consentement_rgpd: questionnaire.consentement_rgpd
          ? questionnaire.date_consentement_rgpd || nowIso
          : null,
        date_derniere_sauvegarde: nowIso,
      };

      const { error: upErr } = await supabase
        .from("questionnaire_besoins")
        .update(payload)
        .eq("id", questionnaire.id);

      if (upErr) throw upErr;

      dirtyRef.current = false;
      setQuestionnaire((prev) => (prev ? { ...prev, ...payload } : prev));

      if (!opts?.silent) {
        toast({
          title: "Sauvegardé",
          description: "Vos réponses ont été enregistrées.",
        });
      }
    } catch (e: any) {
      console.error("Autosave failed", e);
      if (!opts?.silent) {
        toast({
          title: "Erreur",
          description: "Impossible de sauvegarder. Réessayez.",
          variant: "destructive",
        });
      }
    } finally {
      setSaving(false);
    }
  };

  const hasUnvalidatedPrerequisites = () => {
    if (!training?.prerequisites || training.prerequisites.length === 0) return false;
    return training.prerequisites.some(prereq => {
      const validation = prerequisValidations[prereq];
      return validation === "non" || validation === "partiellement";
    });
  };

  const submit = async () => {
    if (!questionnaire) return;
    if (!questionnaire.consentement_rgpd) {
      toast({
        title: "Consentement requis",
        description: "Veuillez accepter la clause RGPD pour soumettre le questionnaire.",
        variant: "destructive",
      });
      return;
    }

    setSubmitting(true);
    try {
      // Ensure latest answers saved
      await saveDraft({ silent: true });

      const nowIso = new Date().toISOString();
      const needsPrerequisEmail = hasUnvalidatedPrerequisites();

      const { error: upErr } = await supabase
        .from("questionnaire_besoins")
        .update({
          etat: "complete",
          date_soumission: nowIso,
          date_consentement_rgpd: questionnaire.date_consentement_rgpd || nowIso,
          necessite_validation_formateur: needsPrerequisEmail,
        })
        .eq("id", questionnaire.id);

      if (upErr) throw upErr;

      await insertEvent(questionnaire.id, "submitted", { source: "public_link" });

      // Send confirmation email
      try {
        await supabase.functions.invoke("send-questionnaire-confirmation", {
          body: {
            questionnaireId: questionnaire.id,
            trainingId: questionnaire.training_id,
            participantEmail: questionnaire.email,
            participantFirstName: questionnaire.prenom || "participant",
            formatFormation: training?.format_formation,
          },
        });
      } catch (emailErr) {
        console.warn("Failed to send confirmation email", emailErr);
      }

      // Send prerequisite warning email if needed
      if (needsPrerequisEmail) {
        try {
          await supabase.functions.invoke("send-prerequis-warning", {
            body: {
              questionnaireId: questionnaire.id,
              participantEmail: questionnaire.email,
              participantName: displayName || questionnaire.prenom || "Participant",
              trainingName: training?.training_name || "Formation",
              prerequisValidations,
            },
          });
        } catch (emailErr) {
          console.warn("Failed to send prerequisite warning email", emailErr);
        }
      }

      // Send accessibility needs email if participant has specific needs
      if (questionnaire.besoins_accessibilite && questionnaire.besoins_accessibilite.trim()) {
        try {
          await supabase.functions.invoke("send-accessibility-needs", {
            body: {
              questionnaireId: questionnaire.id,
              trainingId: questionnaire.training_id,
              participantEmail: questionnaire.email,
              participantFirstName: questionnaire.prenom || "",
              accessibilityNeeds: questionnaire.besoins_accessibilite,
              trainingName: training?.training_name || "Formation",
            },
          });
        } catch (emailErr) {
          console.warn("Failed to send accessibility needs email", emailErr);
        }
      }

      dirtyRef.current = false;
      toast({
        title: "Merci !",
        description: "Votre questionnaire a bien été envoyé.",
      });

      setQuestionnaire((prev) =>
        prev ? { ...prev, etat: "complete", date_soumission: nowIso } : prev
      );
    } catch (e: any) {
      console.error("Submit failed", e);
      toast({
        title: "Erreur",
        description: "Impossible de soumettre le questionnaire. Réessayez.",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  // Auto-save timer (every 30 seconds)
  useEffect(() => {
    if (autosaveTimerRef.current) {
      window.clearInterval(autosaveTimerRef.current);
    }

    autosaveTimerRef.current = window.setInterval(() => {
      if (dirtyRef.current && !saving && !submitting) {
        void saveDraft({ silent: true });
      }
    }, 30_000);

    return () => {
      if (autosaveTimerRef.current) {
        window.clearInterval(autosaveTimerRef.current);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [saving, submitting, questionnaire?.id]);

  // Save on visibility change (when user switches tabs or minimizes)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden" && dirtyRef.current && questionnaire && !saving && !submitting) {
        // Use sendBeacon for reliable save when tab is being hidden
        const nowIso = new Date().toISOString();
        const payload = {
          prenom: questionnaire.prenom,
          nom: questionnaire.nom,
          societe: questionnaire.societe,
          fonction: questionnaire.fonction,
          experience_sujet: questionnaire.experience_sujet,
          experience_details: questionnaire.experience_details,
          lecture_programme: questionnaire.lecture_programme,
          prerequis_validation: questionnaire.prerequis_validation,
          prerequis_details: questionnaire.prerequis_details,
          competences_actuelles: questionnaire.competences_actuelles,
          competences_visees: questionnaire.competences_visees,
          lien_mission: questionnaire.lien_mission,
          niveau_actuel: questionnaire.niveau_actuel,
          niveau_motivation: questionnaire.niveau_motivation,
          modalites_preferences: prerequisValidations,
          contraintes_orga: questionnaire.contraintes_orga,
          besoins_accessibilite: questionnaire.besoins_accessibilite,
          necessite_amenagement: questionnaire.necessite_amenagement,
          commentaires_libres: questionnaire.commentaires_libres,
          consentement_rgpd: questionnaire.consentement_rgpd,
          date_consentement_rgpd: questionnaire.consentement_rgpd
            ? questionnaire.date_consentement_rgpd || nowIso
            : null,
          date_derniere_sauvegarde: nowIso,
        };
        
        // Fallback: trigger async save (may not complete if tab closes immediately)
        void saveDraft({ silent: true });
        
        // Also save to localStorage as backup
        try {
          localStorage.setItem(`questionnaire_draft_${questionnaire.id}`, JSON.stringify({
            ...payload,
            _savedAt: nowIso,
          }));
        } catch (e) {
          console.warn("Failed to save to localStorage", e);
        }
      }
    };

    // Save before page unload
    const handleBeforeUnload = () => {
      if (dirtyRef.current && questionnaire) {
        const nowIso = new Date().toISOString();
        try {
          localStorage.setItem(`questionnaire_draft_${questionnaire.id}`, JSON.stringify({
            prenom: questionnaire.prenom,
            nom: questionnaire.nom,
            societe: questionnaire.societe,
            fonction: questionnaire.fonction,
            experience_sujet: questionnaire.experience_sujet,
            experience_details: questionnaire.experience_details,
            lecture_programme: questionnaire.lecture_programme,
            prerequis_validation: questionnaire.prerequis_validation,
            prerequis_details: questionnaire.prerequis_details,
            competences_actuelles: questionnaire.competences_actuelles,
            competences_visees: questionnaire.competences_visees,
            lien_mission: questionnaire.lien_mission,
            niveau_actuel: questionnaire.niveau_actuel,
            niveau_motivation: questionnaire.niveau_motivation,
            modalites_preferences: prerequisValidations,
            contraintes_orga: questionnaire.contraintes_orga,
            besoins_accessibilite: questionnaire.besoins_accessibilite,
            necessite_amenagement: questionnaire.necessite_amenagement,
            commentaires_libres: questionnaire.commentaires_libres,
            consentement_rgpd: questionnaire.consentement_rgpd,
            date_consentement_rgpd: questionnaire.consentement_rgpd
              ? questionnaire.date_consentement_rgpd || nowIso
              : null,
            _savedAt: nowIso,
          }));
        } catch (e) {
          console.warn("Failed to save to localStorage on unload", e);
        }
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [questionnaire, saving, submitting, prerequisValidations]);

  // Restore from localStorage if local draft is newer than DB
  useEffect(() => {
    if (!questionnaire) return;
    
    try {
      const savedDraft = localStorage.getItem(`questionnaire_draft_${questionnaire.id}`);
      if (savedDraft) {
        const draft = JSON.parse(savedDraft);
        const draftTime = new Date(draft._savedAt).getTime();
        const dbTime = questionnaire.date_derniere_sauvegarde 
          ? new Date(questionnaire.date_derniere_sauvegarde).getTime() 
          : 0;
        
        // If local draft is newer than DB, restore it
        if (draftTime > dbTime) {
          setQuestionnaire((prev) => prev ? {
            ...prev,
            prenom: draft.prenom ?? prev.prenom,
            nom: draft.nom ?? prev.nom,
            societe: draft.societe ?? prev.societe,
            fonction: draft.fonction ?? prev.fonction,
            experience_sujet: draft.experience_sujet ?? prev.experience_sujet,
            experience_details: draft.experience_details ?? prev.experience_details,
            lecture_programme: draft.lecture_programme ?? prev.lecture_programme,
            prerequis_validation: draft.prerequis_validation ?? prev.prerequis_validation,
            prerequis_details: draft.prerequis_details ?? prev.prerequis_details,
            competences_actuelles: draft.competences_actuelles ?? prev.competences_actuelles,
            competences_visees: draft.competences_visees ?? prev.competences_visees,
            lien_mission: draft.lien_mission ?? prev.lien_mission,
            niveau_actuel: draft.niveau_actuel ?? prev.niveau_actuel,
            niveau_motivation: draft.niveau_motivation ?? prev.niveau_motivation,
            contraintes_orga: draft.contraintes_orga ?? prev.contraintes_orga,
            besoins_accessibilite: draft.besoins_accessibilite ?? prev.besoins_accessibilite,
            necessite_amenagement: draft.necessite_amenagement ?? prev.necessite_amenagement,
            commentaires_libres: draft.commentaires_libres ?? prev.commentaires_libres,
            consentement_rgpd: draft.consentement_rgpd ?? prev.consentement_rgpd,
          } : prev);
          
          if (draft.modalites_preferences) {
            setPrerequisValidations(draft.modalites_preferences);
          }
          
          // Mark as dirty so it gets synced to DB
          dirtyRef.current = true;
          
          // Clean up localStorage after restoring
          localStorage.removeItem(`questionnaire_draft_${questionnaire.id}`);
          
          toast({
            title: "Brouillon restauré",
            description: "Vos réponses non sauvegardées ont été récupérées.",
          });
        } else {
          // DB is newer, remove stale localStorage
          localStorage.removeItem(`questionnaire_draft_${questionnaire.id}`);
        }
      }
    } catch (e) {
      console.warn("Failed to restore from localStorage", e);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [questionnaire?.id]);

  const formatScheduleDate = (dateStr: string) => {
    try {
      return format(new Date(dateStr), "EEEE d MMMM yyyy", { locale: fr });
    } catch {
      return dateStr;
    }
  };

  const formatTime = (timeStr: string) => {
    return timeStr.slice(0, 5);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error || !questionnaire) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-6">
        <Card className="w-full max-w-lg">
          <CardHeader>
            <CardTitle>Questionnaire</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-muted-foreground">{error || "Questionnaire introuvable."}</p>
            <Button asChild variant="outline">
              <a href="/">Retour à l'accueil</a>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Already submitted - show confirmation with option to edit
  if (questionnaire.etat === "complete" && !editingAfterSubmit) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-6">
        <Card className="w-full max-w-lg">
          <CardHeader className="text-center">
            <CheckCircle2 className="w-16 h-16 text-primary mx-auto mb-4" />
            <CardTitle>Questionnaire envoyé !</CardTitle>
            <CardDescription>
              Merci d'avoir complété le questionnaire de recueil des besoins pour la formation "{training?.training_name}".
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-center">
            <p className="text-muted-foreground">
              Vos réponses ont bien été enregistrées et seront utilisées pour adapter la formation à vos attentes.
            </p>
            <Button
              variant="outline"
              onClick={() => setEditingAfterSubmit(true)}
            >
              Modifier mes réponses
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-4 md:p-6">
      <div className="mx-auto w-full max-w-3xl space-y-6">
        {/* Logo */}
        <div className="flex justify-center">
          <a href="https://www.supertilt.fr" target="_blank" rel="noopener noreferrer">
            <img src={supertiltLogo} alt="SuperTilt" className="h-12 md:h-16" />
          </a>
        </div>

        {/* Header with training info */}
        <Card>
          <CardHeader>
            <CardTitle className="text-xl md:text-2xl">Questionnaire de recueil des besoins</CardTitle>
            {training && (
              <CardDescription className="space-y-3 pt-2">
                <p className="text-base font-medium text-foreground">
                  {training.training_name}
                </p>
                {schedules.length > 0 && (
                  <div className="space-y-1">
                    {schedules.map((sched, idx) => (
                      <div key={idx} className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Calendar className="w-4 h-4" />
                        <span className="capitalize">{formatScheduleDate(sched.day_date)}</span>
                        <Clock className="w-4 h-4 ml-2" />
                        <span>{formatTime(sched.start_time)} - {formatTime(sched.end_time)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </CardDescription>
            )}
          </CardHeader>
        </Card>

        {/* Identity section */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Vos coordonnées</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="prenom">Prénom</Label>
                <Input
                  id="prenom"
                  value={questionnaire.prenom || ""}
                  onChange={(e) => {
                    markDirty();
                    setQuestionnaire((p) => (p ? { ...p, prenom: e.target.value } : p));
                  }}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="nom">Nom</Label>
                <Input
                  id="nom"
                  value={questionnaire.nom || ""}
                  onChange={(e) => {
                    markDirty();
                    setQuestionnaire((p) => (p ? { ...p, nom: e.target.value } : p));
                  }}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="societe">Société</Label>
                <Input
                  id="societe"
                  value={questionnaire.societe || ""}
                  onChange={(e) => {
                    markDirty();
                    setQuestionnaire((p) => (p ? { ...p, societe: e.target.value } : p));
                  }}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="fonction">Fonction</Label>
                <Input
                  id="fonction"
                  value={questionnaire.fonction || ""}
                  onChange={(e) => {
                    markDirty();
                    setQuestionnaire((p) => (p ? { ...p, fonction: e.target.value } : p));
                  }}
                />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="email">Email</Label>
                <Input id="email" value={questionnaire.email || ""} readOnly className="bg-muted" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 1. Experience */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">1. Votre expérience sur le sujet</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              <Label>Avez-vous déjà suivi une formation ou pratiqué ce sujet professionnellement ?</Label>
              <RadioGroup
                value={questionnaire.experience_sujet || ""}
                onValueChange={(value) => {
                  markDirty();
                  setQuestionnaire((p) => (p ? { ...p, experience_sujet: value } : p));
                }}
                className="flex flex-col space-y-2"
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="oui" id="exp-oui" />
                  <Label htmlFor="exp-oui" className="font-normal cursor-pointer">Oui</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="non" id="exp-non" />
                  <Label htmlFor="exp-non" className="font-normal cursor-pointer">Non</Label>
                </div>
              </RadioGroup>
            </div>
            {questionnaire.experience_sujet === "oui" && (
              <div className="space-y-2">
                <Label htmlFor="experience_details">Précisez votre expérience</Label>
                <Textarea
                  id="experience_details"
                  value={questionnaire.experience_details || ""}
                  onChange={(e) => {
                    markDirty();
                    setQuestionnaire((p) => (p ? { ...p, experience_details: e.target.value } : p));
                  }}
                  rows={3}
                  placeholder="Décrivez votre contexte, vos enjeux..."
                />
              </div>
            )}
          </CardContent>
        </Card>

        {/* 2. Programme et prérequis */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">2. Programme et prérequis</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-3">
              <Label>Avez-vous consulté le programme de formation ?</Label>
              <div className="flex items-center gap-4">
                <RadioGroup
                  value={questionnaire.lecture_programme || ""}
                  onValueChange={(value) => {
                    markDirty();
                    setQuestionnaire((p) => (p ? { ...p, lecture_programme: value } : p));
                  }}
                  className="flex space-x-4"
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="oui" id="prog-oui" />
                    <Label htmlFor="prog-oui" className="font-normal cursor-pointer">Oui</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="non" id="prog-non" />
                    <Label htmlFor="prog-non" className="font-normal cursor-pointer">Non</Label>
                  </div>
                </RadioGroup>
                {training?.program_file_url && (
                  <Button variant="outline" size="sm" asChild>
                    <a href={training.program_file_url} target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="w-4 h-4 mr-2" />
                      Consulter le programme
                    </a>
                  </Button>
                )}
              </div>
            </div>

            {training?.prerequisites && training.prerequisites.length > 0 && (
              <div className="space-y-4">
                <Label className="text-base font-medium">Validez-vous les prérequis suivants ?</Label>
                <div className="space-y-4 border rounded-lg p-4 bg-muted/50">
                  {training.prerequisites.map((prereq, idx) => (
                    <div key={idx} className="space-y-2">
                      <p className="text-sm font-medium">{prereq}</p>
                      <RadioGroup
                        value={prerequisValidations[prereq] || ""}
                        onValueChange={(value) => {
                          markDirty();
                          setPrerequisValidations((prev) => ({ ...prev, [prereq]: value }));
                        }}
                        className="flex flex-wrap gap-4"
                      >
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="oui" id={`prereq-${idx}-oui`} />
                          <Label htmlFor={`prereq-${idx}-oui`} className="font-normal cursor-pointer text-sm">
                            Oui, je valide
                          </Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="partiellement" id={`prereq-${idx}-part`} />
                          <Label htmlFor={`prereq-${idx}-part`} className="font-normal cursor-pointer text-sm">
                            Partiellement
                          </Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="non" id={`prereq-${idx}-non`} />
                          <Label htmlFor={`prereq-${idx}-non`} className="font-normal cursor-pointer text-sm">
                            Non
                          </Label>
                        </div>
                      </RadioGroup>
                    </div>
                  ))}
                </div>
                
                {hasUnvalidatedPrerequisites() && (
                  <div className="space-y-2">
                    <Label htmlFor="prerequis_details">Lesquels vous manquent-ils ?</Label>
                    <Textarea
                      id="prerequis_details"
                      value={questionnaire.prerequis_details || ""}
                      onChange={(e) => {
                        markDirty();
                        setQuestionnaire((p) => (p ? { ...p, prerequis_details: e.target.value } : p));
                      }}
                      rows={3}
                      placeholder="Précisez ce qui vous manque..."
                    />
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* 3. Auto-évaluation */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">3. Auto-évaluation</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Label>Évaluez votre niveau actuel sur ce sujet (0 = débutant, 5 = expert)</Label>
            <div className="space-y-4">
              <Slider
                value={[questionnaire.niveau_actuel ?? 0]}
                onValueChange={([value]) => {
                  markDirty();
                  setQuestionnaire((p) => (p ? { ...p, niveau_actuel: value } : p));
                }}
                max={5}
                step={1}
                className="w-full"
              />
              <div className="flex justify-between text-sm text-muted-foreground">
                <span>0 - Débutant</span>
                <span className="font-medium text-foreground text-lg">{questionnaire.niveau_actuel ?? 0}</span>
                <span>5 - Expert</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 4. Compétences visées */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">4. Compétences visées et objectifs</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <Label htmlFor="competences_visees">
              Quelles compétences concrètes souhaitez-vous acquérir et comment s'inscrivent-elles dans votre mission ?
            </Label>
            <Textarea
              id="competences_visees"
              value={questionnaire.competences_visees || ""}
              onChange={(e) => {
                markDirty();
                setQuestionnaire((p) => (p ? { ...p, competences_visees: e.target.value } : p));
              }}
              rows={4}
              placeholder="Décrivez les compétences que vous souhaitez développer et leur lien avec votre activité..."
            />
          </CardContent>
        </Card>

        {/* 5. Niveau de motivation */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">5. Niveau de motivation</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Label>Quel est votre niveau de motivation à venir à cette formation ? (1 à 5)</Label>
            <div className="space-y-4">
              <Slider
                value={[questionnaire.niveau_motivation ?? 3]}
                onValueChange={([value]) => {
                  markDirty();
                  setQuestionnaire((p) => (p ? { ...p, niveau_motivation: value } : p));
                }}
                min={1}
                max={5}
                step={1}
                className="w-full"
              />
              <div className="flex justify-between text-sm text-muted-foreground">
                <span>1</span>
                <span className="font-medium text-foreground text-lg">{questionnaire.niveau_motivation ?? 3}</span>
                <span>5</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 6. Contraintes d'organisation (inter only) */}
        {isInterEntreprises && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">6. Contraintes d'organisation</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Label htmlFor="contraintes">
                Avez-vous des contraintes horaires ou organisationnelles à signaler ?
              </Label>
              <Textarea
                id="contraintes"
                value={questionnaire.contraintes_orga || ""}
                onChange={(e) => {
                  markDirty();
                  setQuestionnaire((p) => (p ? { ...p, contraintes_orga: e.target.value } : p));
                }}
                rows={3}
                placeholder="Horaires, déplacements, matériel..."
              />
            </CardContent>
          </Card>
        )}

        {/* 7. Accessibilité */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">{isInterEntreprises ? "7" : "6"}. Accessibilité et aménagements</CardTitle>
            <CardDescription>Optionnel</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="accessibilite">
                Avez-vous besoin d'aménagements spécifiques (liés à une situation de handicap moteur, visuel ou auditif, trouble dys, autisme, difficulté d'attention, autre) ?
              </Label>
              <Textarea
                id="accessibilite"
                value={questionnaire.besoins_accessibilite || ""}
                onChange={(e) => {
                  markDirty();
                  setQuestionnaire((p) => (p ? { ...p, besoins_accessibilite: e.target.value } : p));
                }}
                rows={3}
                placeholder="Décrivez vos besoins..."
              />
            </div>
            <p className="text-sm text-muted-foreground border-l-2 border-primary pl-3">
              Notre référent handicap : <strong>Romain Couturier</strong> -{" "}
              <a href="mailto:romain@supertilt.fr" className="text-primary hover:underline">
                romain@supertilt.fr
              </a>
            </p>
          </CardContent>
        </Card>

        {/* 8. Commentaires libres */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">{isInterEntreprises ? "8" : "7"}. Commentaires libres</CardTitle>
            <CardDescription>Optionnel</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <Label htmlFor="commentaires">
              Autres éléments à partager pour optimiser votre expérience ?
            </Label>
            <Textarea
              id="commentaires"
              value={questionnaire.commentaires_libres || ""}
              onChange={(e) => {
                markDirty();
                setQuestionnaire((p) => (p ? { ...p, commentaires_libres: e.target.value } : p));
              }}
              rows={3}
            />
          </CardContent>
        </Card>

        {/* 9. RGPD */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">{isInterEntreprises ? "9" : "8"}. Consentement RGPD</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-start gap-3 rounded-md border p-4 bg-muted/30">
              <Checkbox
                id="rgpd"
                checked={questionnaire.consentement_rgpd}
                onCheckedChange={(checked) => {
                  markDirty();
                  setQuestionnaire((p) =>
                    p ? { ...p, consentement_rgpd: Boolean(checked) } : p
                  );
                }}
              />
              <div className="space-y-2">
                <Label htmlFor="rgpd" className="cursor-pointer">
                  J'autorise SuperTilt à utiliser mes réponses pour adapter cette formation.
                </Label>
                <p className="text-sm text-muted-foreground">
                  Mes données sont conservées 3 ans (exigence Qualiopi) et ne sont jamais communiquées à des tiers.
                </p>
                <Link
                  to="/politique-confidentialite"
                  target="_blank"
                  className="text-sm text-primary hover:underline inline-flex items-center gap-1"
                >
                  Politique de confidentialité
                  <ExternalLink className="w-3 h-3" />
                </Link>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-3 justify-end pb-6">
          <Button
            type="button"
            variant="outline"
            onClick={() => saveDraft()}
            disabled={saving || submitting}
          >
            {saving ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Sauvegarde...
              </>
            ) : (
              "Sauvegarder"
            )}
          </Button>
          <Button type="button" onClick={submit} disabled={saving || submitting}>
            {submitting ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Envoi...
              </>
            ) : (
              "Envoyer le questionnaire"
            )}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default Questionnaire;
