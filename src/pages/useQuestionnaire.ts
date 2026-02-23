import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import type {
  SaveStatus,
  QuestionnaireRecord,
  TrainingRecord,
  ScheduleRecord,
} from "./Questionnaire.types";

export function useQuestionnaire() {
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

  // Online/offline detection (saveDraft uses refs for current state, safe to omit)
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Save on field blur - debounced (saveDraft uses refs for current state, safe to omit)
  const handleFieldBlur = useCallback(() => {
    if (dirtyRef.current && initialLoadCompleteRef.current) {
      if (autosaveTimerRef.current) {
        window.clearTimeout(autosaveTimerRef.current);
      }
      autosaveTimerRef.current = window.setTimeout(() => {
        void saveDraft({ silent: true });
      }, 1500);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const insertEvent = async (
    questionnaireId: string,
    type_evenement: string,
    metadata?: Record<string, unknown>,
  ) => {
    try {
      await supabase.from("questionnaire_events").insert([
        {
          questionnaire_id: questionnaireId,
          type_evenement,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
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

      if (qTyped.besoins_accessibilite && qTyped.besoins_accessibilite.trim()) {
        setAccessibiliteChoice("oui");
      } else if (
        qTyped.besoins_accessibilite !== null &&
        qTyped.besoins_accessibilite !== undefined
      ) {
        setAccessibiliteChoice("non");
      }

      if (qTyped.modalites_preferences) {
        setPrerequisValidations(qTyped.modalites_preferences as Record<string, string>);
      }

      const { data: t, error: tErr } = await supabase
        .from("trainings")
        .select(
          "training_name,start_date,end_date,prerequisites,program_file_url,format_formation,location",
        )
        .eq("id", qTyped.training_id)
        .single();

      if (!tErr && t) {
        setTraining(t as unknown as TrainingRecord);

        if (t.prerequisites && Array.isArray(t.prerequisites)) {
          const existingValidations =
            (qTyped.modalites_preferences as Record<string, string>) || {};
          const newValidations: Record<string, string> = {};
          t.prerequisites.forEach((prereq: string) => {
            newValidations[prereq] = existingValidations[prereq] || "";
          });
          setPrerequisValidations(newValidations);
        }
      }

      const { data: sched, error: schedErr } = await supabase
        .from("training_schedules")
        .select("day_date, start_time, end_time")
        .eq("training_id", qTyped.training_id)
        .order("day_date", { ascending: true });

      if (!schedErr && sched) {
        setSchedules(sched as ScheduleRecord[]);
      }

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
    } catch (e: unknown) {
      console.error("Failed to load questionnaire", e);
      setError("Impossible d'ouvrir ce questionnaire (lien invalide, expiré, ou accès refusé).");
    } finally {
      setLoading(false);
      initialLoadCompleteRef.current = true;
    }
  };

  const saveDraft = async (opts?: { silent?: boolean; force?: boolean }) => {
    const currentQuestionnaire = questionnaireRef.current;
    const currentPrerequisValidations = prerequisValidationsRef.current;

    if (!currentQuestionnaire) return;
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
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
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

      if (saveStatusTimerRef.current) window.clearTimeout(saveStatusTimerRef.current);
      saveStatusTimerRef.current = window.setTimeout(() => setSaveStatus("idle"), 3000);

      if (!opts?.silent) {
        toast({
          title: "Sauvegardé",
          description: "Vos réponses ont été enregistrées.",
        });
      }
    } catch (e: unknown) {
      console.error("Autosave failed", e);
      setSaveStatus("error");

      try {
        localStorage.setItem(
          `questionnaire_draft_${currentQuestionnaire.id}`,
          JSON.stringify({
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
          }),
        );
      } catch (lsErr) {
        console.warn("Failed to save emergency backup to localStorage", lsErr);
      }

      if (!opts?.silent) {
        toast({
          title: "Erreur de sauvegarde",
          description:
            "Vos réponses sont conservées localement. Elles seront synchronisées dès que possible.",
          variant: "destructive",
        });
      }
    } finally {
      setSaving(false);
    }
  };

  const hasUnvalidatedPrerequisites = () => {
    if (!training?.prerequisites || training.prerequisites.length === 0) return false;
    return training.prerequisites.some((prereq) => {
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
        prev ? { ...prev, etat: "complete", date_soumission: nowIso } : prev,
      );
    } catch (e: unknown) {
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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    supabase.rpc("get_public_contact" as any).then(({ data }: { data: any }) => {
      if (data && data.length > 0) {
        setContactEmail(data[0].email || "");
        setContactName(data[0].name || "");
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  // Auto-save timer (every 30 seconds)
  useEffect(() => {
    if (!questionnaire?.id) return;

    const intervalId = window.setInterval(() => {
      if (dirtyRef.current && initialLoadCompleteRef.current) {
        void saveDraft({ silent: true });
      }
    }, 30_000);

    return () => {
      window.clearInterval(intervalId);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [questionnaire?.id]);

  // Save on visibility change
  useEffect(() => {
    const handleVisibilityChange = () => {
      const currentQuestionnaire = questionnaireRef.current;
      const currentPrerequisValidations = prerequisValidationsRef.current;

      if (document.visibilityState === "hidden" && dirtyRef.current && currentQuestionnaire) {
        const nowIso = new Date().toISOString();

        void saveDraft({ silent: true });

        try {
          localStorage.setItem(
            `questionnaire_draft_${currentQuestionnaire.id}`,
            JSON.stringify({
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
            }),
          );
        } catch (e) {
          console.warn("Failed to save to localStorage", e);
        }
      }
    };

    const handleBeforeUnload = () => {
      const currentQuestionnaire = questionnaireRef.current;
      const currentPrerequisValidations = prerequisValidationsRef.current;

      if (dirtyRef.current && currentQuestionnaire) {
        const nowIso = new Date().toISOString();
        try {
          localStorage.setItem(
            `questionnaire_draft_${currentQuestionnaire.id}`,
            JSON.stringify({
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
            }),
          );
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
  }, []);

  // Restore from localStorage if local draft is newer than DB
  useEffect(() => {
    if (!questionnaire || !initialLoadCompleteRef.current || localStorageRestoredRef.current)
      return;

    localStorageRestoredRef.current = true;

    try {
      const savedDraft = localStorage.getItem(`questionnaire_draft_${questionnaire.id}`);
      if (savedDraft) {
        const draft = JSON.parse(savedDraft);
        const draftTime = new Date(draft._savedAt).getTime();
        const dbTime = questionnaire.date_derniere_sauvegarde
          ? new Date(questionnaire.date_derniere_sauvegarde).getTime()
          : 0;

        if (draftTime > dbTime) {
          setQuestionnaire((prev) =>
            prev
              ? {
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
                }
              : prev,
          );

          if (draft.modalites_preferences) {
            setPrerequisValidations(draft.modalites_preferences);
          }

          dirtyRef.current = true;

          toast({
            title: "Brouillon restauré",
            description: "Vos réponses non sauvegardées ont été récupérées.",
          });
        }

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

  return {
    loading,
    saving,
    submitting,
    error,
    setError,
    questionnaire,
    setQuestionnaire,
    training,
    schedules,
    prerequisValidations,
    setPrerequisValidations,
    editingAfterSubmit,
    setEditingAfterSubmit,
    saveStatus,
    isOnline,
    retryCount,
    setRetryCount,
    contactEmail,
    contactName,
    accessibiliteChoice,
    setAccessibiliteChoice,
    displayName,
    isInterEntreprises,
    markDirty,
    handleFieldBlur,
    fetchData,
    saveDraft,
    hasUnvalidatedPrerequisites,
    submit,
    formatScheduleDate,
    formatTime,
    setLoading,
  };
}
