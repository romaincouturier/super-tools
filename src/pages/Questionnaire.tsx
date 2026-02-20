import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import { Loader2, ExternalLink, Calendar, Clock, CheckCircle2, MapPin, Video, WifiOff, RefreshCw, Save, AlertTriangle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import supertiltLogo from "@/assets/supertilt-logo-anthracite-transparent.png";

type SaveStatus = "idle" | "saving" | "saved" | "error";

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
  location: string | null;
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
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [retryCount, setRetryCount] = useState(0);
  const [contactEmail, setContactEmail] = useState("");
  const [contactName, setContactName] = useState("");

  const dirtyRef = useRef(false);
  const autosaveTimerRef = useRef<number | null>(null);
  const initialLoadCompleteRef = useRef(false);
  const localStorageRestoredRef = useRef(false);
  const questionnaireRef = useRef<QuestionnaireRecord | null>(null);
  const prerequisValidationsRef = useRef<Record<string, string>>({});
  const saveStatusTimerRef = useRef<number | null>(null);
  const [accessibiliteChoice, setAccessibiliteChoice] = useState<"" | "oui" | "non">("");

  const displayName = useMemo(() => {
    if (!questionnaire) return "";
    const parts = [questionnaire.prenom, questionnaire.nom].filter(Boolean);
    return parts.join(" ").trim();
  }, [questionnaire]);

  const isInterEntreprises = training?.format_formation === "inter";

  // Keep refs in sync with state for use in callbacks
  useEffect(() => {
    questionnaireRef.current = questionnaire;
  }, [questionnaire]);

  useEffect(() => {
    prerequisValidationsRef.current = prerequisValidations;
  }, [prerequisValidations]);

  const markDirty = () => {
    dirtyRef.current = true;
    setSaveStatus("idle");
  };

  // Online/offline detection
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      // Auto-retry save when coming back online
      if (dirtyRef.current) {
        void saveDraft({ silent: true });
      }
    };
    const handleOffline = () => setIsOnline(false);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  // Save on field blur - debounced
  const handleFieldBlur = useCallback(() => {
    if (dirtyRef.current && initialLoadCompleteRef.current) {
      // Small delay to batch rapid blur events
      if (autosaveTimerRef.current) {
        window.clearTimeout(autosaveTimerRef.current);
      }
      autosaveTimerRef.current = window.setTimeout(() => {
        void saveDraft({ silent: true });
      }, 1500);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

      // Initialize accessibility choice based on existing data
      if (qTyped.besoins_accessibilite && qTyped.besoins_accessibilite.trim()) {
        setAccessibiliteChoice("oui");
      } else if (qTyped.besoins_accessibilite !== null && qTyped.besoins_accessibilite !== undefined) {
        setAccessibiliteChoice("non");
      }

      // Parse existing prerequis validations
      if (qTyped.modalites_preferences) {
        setPrerequisValidations(qTyped.modalites_preferences as Record<string, string>);
      }

      const { data: t, error: tErr } = await supabase
        .from("trainings")
        .select("training_name,start_date,end_date,prerequisites,program_file_url,format_formation,location")
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

      // First open tracking - non-blocking to avoid preventing access
      if (!qTyped.date_premiere_ouverture) {
        const nowIso = new Date().toISOString();
        try {
          await supabase
            .from("questionnaire_besoins")
            .update({
              date_premiere_ouverture: nowIso,
              etat: qTyped.etat === "envoye" ? "accueil_envoye" : qTyped.etat,
            })
            .eq("id", qTyped.id);
          await insertEvent(qTyped.id, "opened", { source: "public_link" });
        } catch (trackingErr) {
          console.warn("First open tracking failed (non-blocking):", trackingErr);
        }
      }
    } catch (e: any) {
      console.error("Failed to load questionnaire", e);
      setError(
        "Impossible d'ouvrir ce questionnaire (lien invalide, expiré, ou accès refusé)."
      );
    } finally {
      setLoading(false);
      initialLoadCompleteRef.current = true;
    }
  };

  const saveDraft = async (opts?: { silent?: boolean; force?: boolean }) => {
    // Use ref to get current state - avoids stale closures in timers
    const currentQuestionnaire = questionnaireRef.current;
    const currentPrerequisValidations = prerequisValidationsRef.current;
    
    if (!currentQuestionnaire) return;
    // Skip if not dirty, unless force is true (used during submission)
    if (!dirtyRef.current && !opts?.force) return;

    const nowIso = new Date().toISOString();
    setSaving(true);
    setSaveStatus("saving");
    try {
      const payload = {
        prenom: currentQuestionnaire.prenom,
        nom: currentQuestionnaire.nom,
        societe: currentQuestionnaire.societe,
        fonction: currentQuestionnaire.fonction,
        experience_sujet: currentQuestionnaire.experience_sujet,
        experience_details: currentQuestionnaire.experience_details,
        lecture_programme: currentQuestionnaire.lecture_programme,
        prerequis_validation: currentQuestionnaire.prerequis_validation,
        prerequis_details: currentQuestionnaire.prerequis_details,
        competences_actuelles: currentQuestionnaire.competences_actuelles,
        competences_visees: currentQuestionnaire.competences_visees,
        lien_mission: currentQuestionnaire.lien_mission,
        niveau_actuel: currentQuestionnaire.niveau_actuel,
        niveau_motivation: currentQuestionnaire.niveau_motivation,
        modalites_preferences: currentPrerequisValidations as any,
        contraintes_orga: currentQuestionnaire.contraintes_orga,
        besoins_accessibilite: currentQuestionnaire.besoins_accessibilite,
        necessite_amenagement: currentQuestionnaire.necessite_amenagement,
        commentaires_libres: currentQuestionnaire.commentaires_libres,
        consentement_rgpd: currentQuestionnaire.consentement_rgpd,
        date_consentement_rgpd: currentQuestionnaire.consentement_rgpd
          ? currentQuestionnaire.date_consentement_rgpd || nowIso
          : null,
        date_derniere_sauvegarde: nowIso,
      };

      const { data: updateData, error: upErr } = await supabase
        .from("questionnaire_besoins")
        .update(payload)
        .eq("id", currentQuestionnaire.id)
        .select();

      if (upErr) throw upErr;
      
      if (!updateData || updateData.length === 0) {
        console.warn("No rows were updated - possible RLS policy issue");
      }

      dirtyRef.current = false;
      setSaveStatus("saved");
      setQuestionnaire((prev) => (prev ? { ...prev, ...payload } : prev));

      // Clear "saved" indicator after 3s
      if (saveStatusTimerRef.current) window.clearTimeout(saveStatusTimerRef.current);
      saveStatusTimerRef.current = window.setTimeout(() => setSaveStatus("idle"), 3000);

      if (!opts?.silent) {
        toast({
          title: "Sauvegardé",
          description: "Vos réponses ont été enregistrées.",
        });
      }
    } catch (e: any) {
      console.error("Autosave failed", e);
      setSaveStatus("error");
      
      // Save to localStorage as emergency backup on failure
      try {
        localStorage.setItem(`questionnaire_draft_${currentQuestionnaire.id}`, JSON.stringify({
          prenom: currentQuestionnaire.prenom,
          nom: currentQuestionnaire.nom,
          societe: currentQuestionnaire.societe,
          fonction: currentQuestionnaire.fonction,
          experience_sujet: currentQuestionnaire.experience_sujet,
          experience_details: currentQuestionnaire.experience_details,
          lecture_programme: currentQuestionnaire.lecture_programme,
          prerequis_validation: currentQuestionnaire.prerequis_validation,
          prerequis_details: currentQuestionnaire.prerequis_details,
          competences_actuelles: currentQuestionnaire.competences_actuelles,
          competences_visees: currentQuestionnaire.competences_visees,
          lien_mission: currentQuestionnaire.lien_mission,
          niveau_actuel: currentQuestionnaire.niveau_actuel,
          niveau_motivation: currentQuestionnaire.niveau_motivation,
          modalites_preferences: currentPrerequisValidations,
          contraintes_orga: currentQuestionnaire.contraintes_orga,
          besoins_accessibilite: currentQuestionnaire.besoins_accessibilite,
          necessite_amenagement: currentQuestionnaire.necessite_amenagement,
          commentaires_libres: currentQuestionnaire.commentaires_libres,
          consentement_rgpd: currentQuestionnaire.consentement_rgpd,
          _savedAt: nowIso,
        }));
      } catch (lsErr) {
        console.warn("Failed to save emergency backup to localStorage", lsErr);
      }

      if (!opts?.silent) {
        toast({
          title: "Erreur de sauvegarde",
          description: "Vos réponses sont conservées localement. Elles seront synchronisées dès que possible.",
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
      // Force save all current form values, even if user didn't modify any field
      await saveDraft({ silent: true, force: true });

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

      // Also update participant status and sync company if changed
      const participantUpdate: Record<string, string> = { needs_survey_status: "complete" };
      if (questionnaire.societe) {
        participantUpdate.company = questionnaire.societe;
      }
      
      const { error: participantErr } = await supabase
        .from("training_participants")
        .update(participantUpdate)
        .eq("id", questionnaire.participant_id);

      if (participantErr) {
        console.warn("Failed to update participant", participantErr);
      }

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
    // Fetch contact info from settings
    supabase.rpc("get_public_contact").then(({ data }) => {
      if (data && data.length > 0) {
        setContactEmail(data[0].email || "");
        setContactName(data[0].name || "");
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  // Auto-save timer (every 30 seconds) - stable interval that doesn't recreate on state changes
  useEffect(() => {
    if (!questionnaire?.id) return;
    
    const intervalId = window.setInterval(() => {
      // Check refs and current state inside the callback to avoid stale closures
      if (dirtyRef.current && initialLoadCompleteRef.current) {
        void saveDraft({ silent: true });
      }
    }, 30_000);

    return () => {
      window.clearInterval(intervalId);
    };
    // Only depend on questionnaire ID - saveDraft uses refs for current state
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [questionnaire?.id]);

  // Save on visibility change (when user switches tabs or minimizes)
  useEffect(() => {
    const handleVisibilityChange = () => {
      const currentQuestionnaire = questionnaireRef.current;
      const currentPrerequisValidations = prerequisValidationsRef.current;
      
      if (document.visibilityState === "hidden" && dirtyRef.current && currentQuestionnaire) {
        const nowIso = new Date().toISOString();
        
        // Trigger async save using refs (won't have stale data)
        void saveDraft({ silent: true });
        
        // Also save to localStorage as backup
        try {
          localStorage.setItem(`questionnaire_draft_${currentQuestionnaire.id}`, JSON.stringify({
            prenom: currentQuestionnaire.prenom,
            nom: currentQuestionnaire.nom,
            societe: currentQuestionnaire.societe,
            fonction: currentQuestionnaire.fonction,
            experience_sujet: currentQuestionnaire.experience_sujet,
            experience_details: currentQuestionnaire.experience_details,
            lecture_programme: currentQuestionnaire.lecture_programme,
            prerequis_validation: currentQuestionnaire.prerequis_validation,
            prerequis_details: currentQuestionnaire.prerequis_details,
            competences_actuelles: currentQuestionnaire.competences_actuelles,
            competences_visees: currentQuestionnaire.competences_visees,
            lien_mission: currentQuestionnaire.lien_mission,
            niveau_actuel: currentQuestionnaire.niveau_actuel,
            niveau_motivation: currentQuestionnaire.niveau_motivation,
            modalites_preferences: currentPrerequisValidations,
            contraintes_orga: currentQuestionnaire.contraintes_orga,
            besoins_accessibilite: currentQuestionnaire.besoins_accessibilite,
            necessite_amenagement: currentQuestionnaire.necessite_amenagement,
            commentaires_libres: currentQuestionnaire.commentaires_libres,
            consentement_rgpd: currentQuestionnaire.consentement_rgpd,
            date_consentement_rgpd: currentQuestionnaire.consentement_rgpd
              ? currentQuestionnaire.date_consentement_rgpd || nowIso
              : null,
            _savedAt: nowIso,
          }));
        } catch (e) {
          console.warn("Failed to save to localStorage", e);
        }
      }
    };

    // Save before page unload
    const handleBeforeUnload = () => {
      const currentQuestionnaire = questionnaireRef.current;
      const currentPrerequisValidations = prerequisValidationsRef.current;
      
      if (dirtyRef.current && currentQuestionnaire) {
        const nowIso = new Date().toISOString();
        try {
          localStorage.setItem(`questionnaire_draft_${currentQuestionnaire.id}`, JSON.stringify({
            prenom: currentQuestionnaire.prenom,
            nom: currentQuestionnaire.nom,
            societe: currentQuestionnaire.societe,
            fonction: currentQuestionnaire.fonction,
            experience_sujet: currentQuestionnaire.experience_sujet,
            experience_details: currentQuestionnaire.experience_details,
            lecture_programme: currentQuestionnaire.lecture_programme,
            prerequis_validation: currentQuestionnaire.prerequis_validation,
            prerequis_details: currentQuestionnaire.prerequis_details,
            competences_actuelles: currentQuestionnaire.competences_actuelles,
            competences_visees: currentQuestionnaire.competences_visees,
            lien_mission: currentQuestionnaire.lien_mission,
            niveau_actuel: currentQuestionnaire.niveau_actuel,
            niveau_motivation: currentQuestionnaire.niveau_motivation,
            modalites_preferences: currentPrerequisValidations,
            contraintes_orga: currentQuestionnaire.contraintes_orga,
            besoins_accessibilite: currentQuestionnaire.besoins_accessibilite,
            necessite_amenagement: currentQuestionnaire.necessite_amenagement,
            commentaires_libres: currentQuestionnaire.commentaires_libres,
            consentement_rgpd: currentQuestionnaire.consentement_rgpd,
            date_consentement_rgpd: currentQuestionnaire.consentement_rgpd
              ? currentQuestionnaire.date_consentement_rgpd || nowIso
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
    // No dependencies needed - handlers use refs for current state
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Restore from localStorage if local draft is newer than DB - ONLY ONCE on initial load
  useEffect(() => {
    // Only run once after initial load, and only if not already restored
    if (!questionnaire || !initialLoadCompleteRef.current || localStorageRestoredRef.current) return;
    
    // Mark as restored immediately to prevent re-runs
    localStorageRestoredRef.current = true;
    
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
          
          toast({
            title: "Brouillon restauré",
            description: "Vos réponses non sauvegardées ont été récupérées.",
          });
        }
        
        // Always clean up localStorage after checking
        localStorage.removeItem(`questionnaire_draft_${questionnaire.id}`);
      }
    } catch (e) {
      console.warn("Failed to restore from localStorage", e);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [questionnaire?.id, loading]);

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
            <AlertTriangle className="w-12 h-12 text-destructive mx-auto mb-2" />
            <CardTitle className="text-center">Questionnaire</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-center">
            <p className="text-muted-foreground">{error || "Questionnaire introuvable."}</p>
            <div className="flex flex-col gap-2">
              <Button
                onClick={() => {
                  setRetryCount((c) => c + 1);
                  setError(null);
                  setLoading(true);
                  fetchData();
                }}
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                Réessayer
              </Button>
              <Button asChild variant="outline">
                <a href="/">Retour à l'accueil</a>
              </Button>
            </div>
            {retryCount > 0 && (
              <p className="text-xs text-muted-foreground mt-2">
                Si le problème persiste, vérifiez votre connexion internet ou contactez-nous à{" "}
                <a href={`mailto:${contactEmail}`} className="text-primary hover:underline">{contactEmail}</a>
              </p>
            )}
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
            {questionnaire.date_soumission && (
              <p className="text-xs text-muted-foreground">
                Soumis le {format(new Date(questionnaire.date_soumission), "d MMMM yyyy 'à' HH:mm", { locale: fr })}
              </p>
            )}
            <div className="space-y-2 pt-2">
              <p className="text-sm font-medium">Vous pouvez modifier vos réponses :</p>
              <Button
                className="w-full"
                onClick={() => setEditingAfterSubmit(true)}
              >
                Modifier mes réponses
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-4 md:p-6">
      {/* Offline banner */}
      {!isOnline && (
        <div className="fixed top-0 left-0 right-0 z-50 bg-destructive text-destructive-foreground px-4 py-2 text-center text-sm flex items-center justify-center gap-2">
          <WifiOff className="w-4 h-4" />
          Vous êtes hors connexion. Vos réponses seront sauvegardées dès le retour du réseau.
        </div>
      )}

      {/* Floating save status indicator */}
      {saveStatus !== "idle" && (
        <div className={`fixed bottom-4 right-4 z-50 px-3 py-2 rounded-lg shadow-lg text-sm flex items-center gap-2 transition-all ${
          saveStatus === "saving" ? "bg-muted text-muted-foreground" :
          saveStatus === "saved" ? "bg-primary/10 text-primary" :
          "bg-destructive/10 text-destructive"
        }`}>
          {saveStatus === "saving" && <><Loader2 className="w-3 h-3 animate-spin" /> Sauvegarde...</>}
          {saveStatus === "saved" && <><CheckCircle2 className="w-3 h-3" /> Sauvegardé</>}
          {saveStatus === "error" && (
            <>
              <AlertTriangle className="w-3 h-3" /> 
              Erreur de sauvegarde
              <button 
                onClick={() => saveDraft({ silent: false })} 
                className="underline ml-1 font-medium"
              >
                Réessayer
              </button>
            </>
          )}
        </div>
      )}
      <div className="mx-auto w-full max-w-3xl space-y-6" onBlur={handleFieldBlur}>
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
                  <div className="space-y-2">
                    <div className="grid grid-cols-[1fr_auto] gap-x-6 gap-y-1">
                      {schedules.map((sched, idx) => (
                        <div key={idx} className="contents">
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <Calendar className="w-4 h-4 shrink-0" />
                            <span className="capitalize">{formatScheduleDate(sched.day_date)}</span>
                          </div>
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <Clock className="w-4 h-4 shrink-0" />
                            <span>{formatTime(sched.start_time)} - {formatTime(sched.end_time)}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                    <p className="text-xs text-muted-foreground italic">Horaires indiqués en heure de Paris</p>
                  </div>
                )}
                {training.location && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    {(() => {
                      const loc = training.location.toLowerCase();
                      const isOnline = loc.includes("visio") || loc.includes("en ligne") || loc.includes("distanciel") || loc.includes("zoom") || loc.includes("teams") || loc.includes("meet");
                      const urlMatch = training.location.match(/(https?:\/\/[^\s]+)/);
                      return (
                        <>
                          {isOnline ? <Video className="w-4 h-4 shrink-0" /> : <MapPin className="w-4 h-4 shrink-0" />}
                          {urlMatch ? (
                            <a href={urlMatch[0]} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                              {training.location}
                            </a>
                          ) : (
                            <span>{training.location}</span>
                          )}
                        </>
                      );
                    })()}
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
              <Label>Avez-vous déjà une expérience sur ce sujet ?</Label>
              <RadioGroup
                value={questionnaire.experience_sujet || ""}
                onValueChange={(value) => {
                  markDirty();
                  setQuestionnaire((p) => (p ? { ...p, experience_sujet: value } : p));
                }}
                className="flex flex-col space-y-2"
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="aucune" id="exp-aucune" />
                  <Label htmlFor="exp-aucune" className="font-normal cursor-pointer">Aucune expérience</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="courte" id="exp-courte" />
                  <Label htmlFor="exp-courte" className="font-normal cursor-pointer">Expérience courte (moins de 6 mois)</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="longue" id="exp-longue" />
                  <Label htmlFor="exp-longue" className="font-normal cursor-pointer">Expérience longue (plus de 6 mois)</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="certification" id="exp-certification" />
                  <Label htmlFor="exp-certification" className="font-normal cursor-pointer">Expérience avec certification</Label>
                </div>
              </RadioGroup>
            </div>
            {questionnaire.experience_sujet && questionnaire.experience_sujet !== "aucune" && (
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
                    <RadioGroupItem value="complete" id="prog-complete" />
                    <Label htmlFor="prog-complete" className="font-normal cursor-pointer">Oui, en entier</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="partielle" id="prog-partielle" />
                    <Label htmlFor="prog-partielle" className="font-normal cursor-pointer">Partiellement</Label>
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
            <div className="space-y-3">
              <Label>
                Avez-vous besoin d'aménagements spécifiques (liés à une situation de handicap moteur, visuel ou auditif, trouble dys, autisme, difficulté d'attention, autre) ?
              </Label>
              <RadioGroup
                value={accessibiliteChoice}
                onValueChange={(value: string) => {
                  markDirty();
                  const choice = value as "oui" | "non";
                  setAccessibiliteChoice(choice);
                  if (choice === "non") {
                    setQuestionnaire((p) => (p ? { ...p, besoins_accessibilite: "" } : p));
                  }
                }}
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="non" id="access-non" />
                  <Label htmlFor="access-non" className="cursor-pointer">Non</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="oui" id="access-oui" />
                  <Label htmlFor="access-oui" className="cursor-pointer">Oui</Label>
                </div>
              </RadioGroup>
              {accessibiliteChoice === "oui" && (
                <div className="space-y-2 pl-6 border-l-2 border-primary/30">
                  <Label htmlFor="accessibilite">Décrivez vos besoins :</Label>
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
              )}
            </div>
            <p className="text-sm text-muted-foreground border-l-2 border-primary pl-3">
              Notre référent handicap : <strong>{contactName}</strong> -{" "}
              <a href={`mailto:${contactEmail}`} className="text-primary hover:underline">
                {contactEmail}
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
