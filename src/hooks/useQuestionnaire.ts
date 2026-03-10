import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { rpc } from "@/lib/supabase-rpc";
import { useToast } from "@/hooks/use-toast";
import { formatDateWithDayOfWeek } from "@/lib/dateFormatters";

export type SaveStatus = "idle" | "saving" | "saved" | "error";

export type QuestionnaireRecord = {
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

export type TrainingRecord = {
  training_name: string;
  start_date: string;
  end_date: string | null;
  prerequisites: string[] | null;
  program_file_url: string | null;
  format_formation: string | null;
  location: string | null;
};

export type ScheduleRecord = {
  day_date: string;
  start_time: string;
  end_time: string;
};

function buildDraftPayload(q: QuestionnaireRecord, pv: Record<string, string>) {
  return {
    prenom: q.prenom,
    nom: q.nom,
    societe: q.societe,
    fonction: q.fonction,
    experience_sujet: q.experience_sujet,
    experience_details: q.experience_details,
    lecture_programme: q.lecture_programme,
    prerequis_validation: q.prerequis_validation,
    prerequis_details: q.prerequis_details,
    competences_actuelles: q.competences_actuelles,
    competences_visees: q.competences_visees,
    lien_mission: q.lien_mission,
    niveau_actuel: q.niveau_actuel,
    niveau_motivation: q.niveau_motivation,
    modalites_preferences: pv,
    contraintes_orga: q.contraintes_orga,
    besoins_accessibilite: q.besoins_accessibilite,
    necessite_amenagement: q.necessite_amenagement,
    commentaires_libres: q.commentaires_libres,
    consentement_rgpd: q.consentement_rgpd,
  };
}

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
  const [accessibiliteChoice, setAccessibiliteChoice] = useState<"" | "oui" | "non">("");

  const dirtyRef = useRef(false);
  const autosaveTimerRef = useRef<number | null>(null);
  const initialLoadCompleteRef = useRef(false);
  const localStorageRestoredRef = useRef(false);
  const questionnaireRef = useRef<QuestionnaireRecord | null>(null);
  const prerequisValidationsRef = useRef<Record<string, string>>({});
  const saveStatusTimerRef = useRef<number | null>(null);

  const displayName = useMemo(() => {
    if (!questionnaire) return "";
    return [questionnaire.prenom, questionnaire.nom].filter(Boolean).join(" ").trim();
  }, [questionnaire]);

  const isInterEntreprises = (training as any)?.session_type === "inter" || training?.format_formation === "inter-entreprises";

  useEffect(() => { questionnaireRef.current = questionnaire; }, [questionnaire]);
  useEffect(() => { prerequisValidationsRef.current = prerequisValidations; }, [prerequisValidations]);

  const markDirty = () => { dirtyRef.current = true; setSaveStatus("idle"); };

  // Online/offline detection
  useEffect(() => {
    const handleOnline = () => { setIsOnline(true); if (dirtyRef.current) void saveDraft({ silent: true }); };
    const handleOffline = () => setIsOnline(false);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => { window.removeEventListener("online", handleOnline); window.removeEventListener("offline", handleOffline); };
  }, []);

  const handleFieldBlur = useCallback(() => {
    if (dirtyRef.current && initialLoadCompleteRef.current) {
      if (autosaveTimerRef.current) window.clearTimeout(autosaveTimerRef.current);
      autosaveTimerRef.current = window.setTimeout(() => { void saveDraft({ silent: true }); }, 1500);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const insertEvent = async (questionnaireId: string, type_evenement: string, metadata?: Record<string, unknown>) => {
    try { await rpc.insertQuestionnaireEvent(questionnaireId, type_evenement, metadata); }
    catch (e) { console.warn("Failed to insert questionnaire event", e); }
  };

  const fetchData = async () => {
    if (!token) { setError("Lien invalide : token manquant."); setLoading(false); return; }
    setLoading(true); setError(null);
    try {
      const { data: qArr, error: qErr } = await rpc.getQuestionnaireByToken(token);
      if (qErr || !qArr || qArr.length === 0) throw qErr || new Error("Questionnaire introuvable");
      const qTyped = qArr[0] as unknown as QuestionnaireRecord;
      setQuestionnaire(qTyped);
      if (qTyped.besoins_accessibilite && qTyped.besoins_accessibilite.trim()) setAccessibiliteChoice("oui");
      else if (qTyped.besoins_accessibilite !== null && qTyped.besoins_accessibilite !== undefined) setAccessibiliteChoice("non");
      if (qTyped.modalites_preferences) setPrerequisValidations(qTyped.modalites_preferences as Record<string, string>);

      const { data: t, error: tErr } = await rpc.getTrainingPublicInfo(qTyped.training_id);
      if (!tErr && t) {
        setTraining(t as unknown as TrainingRecord);
        if (t.prerequisites && Array.isArray(t.prerequisites)) {
          const existing = qTyped.modalites_preferences as Record<string, string> || {};
          const nv: Record<string, string> = {};
          t.prerequisites.forEach((prereq: string) => { nv[prereq] = existing[prereq] || ""; });
          setPrerequisValidations(nv);
        }
      }

      const { data: sched, error: schedErr } = await rpc.getTrainingSchedulesPublic(qTyped.training_id);
      if (!schedErr && sched) setSchedules((Array.isArray(sched) ? sched : []) as ScheduleRecord[]);

      if (!qTyped.date_premiere_ouverture) {
        const nowIso = new Date().toISOString();
        try {
          await rpc.updateQuestionnaireByToken(token, { date_premiere_ouverture: nowIso, etat: qTyped.etat === "envoye" ? "accueil_envoye" : qTyped.etat });
          await insertEvent(qTyped.id, "opened", { source: "public_link" });
        } catch (trackingErr) { console.warn("First open tracking failed (non-blocking):", trackingErr); }
      }
    } catch (e: any) {
      console.error("Failed to load questionnaire", e);
      const errorMsg = "Impossible d'ouvrir ce questionnaire (lien invalide, expiré, ou accès refusé).";
      setError(errorMsg);
      supabase.functions.invoke("alert-form-error", { body: { formType: "besoins", token, errorMessage: e?.message || e?.code || errorMsg, userAgent: navigator.userAgent, url: window.location.href } }).catch(() => {});
    } finally { setLoading(false); initialLoadCompleteRef.current = true; }
  };

  const saveDraft = async (opts?: { silent?: boolean; force?: boolean }) => {
    const cq = questionnaireRef.current;
    const cpv = prerequisValidationsRef.current;
    if (!cq) return;
    if (!dirtyRef.current && !opts?.force) return;
    const nowIso = new Date().toISOString();
    setSaving(true); setSaveStatus("saving");
    try {
      const payload = {
        ...buildDraftPayload(cq, cpv),
        date_consentement_rgpd: cq.consentement_rgpd ? cq.date_consentement_rgpd || nowIso : null,
        date_derniere_sauvegarde: nowIso,
      };
      const { error: upErr } = await rpc.updateQuestionnaireByToken(token!, payload);
      if (upErr) throw upErr;
      dirtyRef.current = false;
      setSaveStatus("saved");
      setQuestionnaire((prev) => (prev ? { ...prev, date_derniere_sauvegarde: nowIso } : prev));
      if (saveStatusTimerRef.current) window.clearTimeout(saveStatusTimerRef.current);
      saveStatusTimerRef.current = window.setTimeout(() => setSaveStatus("idle"), 3000);
      if (!opts?.silent) toast({ title: "Sauvegardé", description: "Vos réponses ont été enregistrées." });
    } catch (e: any) {
      console.error("Autosave failed", e);
      setSaveStatus("error");
      try { localStorage.setItem(`questionnaire_draft_${cq.id}`, JSON.stringify({ ...buildDraftPayload(cq, cpv), _savedAt: nowIso })); }
      catch (lsErr) { console.warn("Failed to save emergency backup to localStorage", lsErr); }
      if (!opts?.silent) toast({ title: "Erreur de sauvegarde", description: "Vos réponses sont conservées localement. Elles seront synchronisées dès que possible.", variant: "destructive" });
    } finally { setSaving(false); }
  };

  const hasUnvalidatedPrerequisites = () => {
    if (!training?.prerequisites || training.prerequisites.length === 0) return false;
    return training.prerequisites.some(prereq => { const v = prerequisValidations[prereq]; return v === "non" || v === "partiellement"; });
  };

  const submit = async () => {
    if (!questionnaire) return;
    if (!questionnaire.consentement_rgpd) {
      toast({ title: "Consentement requis", description: "Veuillez accepter la clause RGPD pour soumettre le questionnaire.", variant: "destructive" });
      return;
    }
    setSubmitting(true);
    try {
      await saveDraft({ silent: true, force: true });
      const nowIso = new Date().toISOString();
      const needsPrerequisEmail = hasUnvalidatedPrerequisites();
      const { error: upErr } = await (supabase.rpc as any)("update_questionnaire_by_token", {
        p_token: token!, p_data: { etat: "complete", date_soumission: nowIso, date_consentement_rgpd: questionnaire.date_consentement_rgpd || nowIso, necessite_validation_formateur: needsPrerequisEmail },
      });
      if (upErr) throw upErr;

      try { await (supabase.rpc as any)("update_participant_after_questionnaire", { p_token: token!, p_company: questionnaire.societe || null }); }
      catch (participantErr) { console.warn("Failed to update participant", participantErr); }

      await insertEvent(questionnaire.id, "submitted", { source: "public_link" });

      try { await supabase.functions.invoke("send-questionnaire-confirmation", { body: { questionnaireId: questionnaire.id, trainingId: questionnaire.training_id, participantEmail: questionnaire.email, participantFirstName: questionnaire.prenom || "participant", formatFormation: training?.format_formation } }); }
      catch (emailErr) { console.warn("Failed to send confirmation email", emailErr); }

      if (needsPrerequisEmail) {
        try { await supabase.functions.invoke("send-prerequis-warning", { body: { questionnaireId: questionnaire.id, participantEmail: questionnaire.email, participantName: displayName || questionnaire.prenom || "Participant", trainingName: training?.training_name || "Formation", prerequisValidations } }); }
        catch (emailErr) { console.warn("Failed to send prerequisite warning email", emailErr); }
      }

      if (questionnaire.besoins_accessibilite && questionnaire.besoins_accessibilite.trim()) {
        try { await supabase.functions.invoke("send-accessibility-needs", { body: { questionnaireId: questionnaire.id, trainingId: questionnaire.training_id, participantEmail: questionnaire.email, participantFirstName: questionnaire.prenom || "", accessibilityNeeds: questionnaire.besoins_accessibilite, trainingName: training?.training_name || "Formation" } }); }
        catch (emailErr) { console.warn("Failed to send accessibility needs email", emailErr); }
      }

      dirtyRef.current = false;
      toast({ title: "Merci !", description: "Votre questionnaire a bien été envoyé." });
      setQuestionnaire((prev) => prev ? { ...prev, etat: "complete", date_soumission: nowIso } : prev);
    } catch (e: any) {
      console.error("Submit failed", e);
      toast({ title: "Erreur", description: "Impossible de soumettre le questionnaire. Réessayez.", variant: "destructive" });
    } finally { setSubmitting(false); }
  };

  useEffect(() => {
    fetchData();
    (supabase.rpc as any)("get_public_contact").then(({ data }: any) => {
      if (data && data.length > 0) { setContactEmail(data[0].email || ""); setContactName(data[0].name || ""); }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  // Auto-save timer
  useEffect(() => {
    if (!questionnaire?.id) return;
    const intervalId = window.setInterval(() => { if (dirtyRef.current && initialLoadCompleteRef.current) void saveDraft({ silent: true }); }, 30_000);
    return () => window.clearInterval(intervalId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [questionnaire?.id]);

  // Save on visibility change / beforeunload
  useEffect(() => {
    const saveToLocalStorage = () => {
      const cq = questionnaireRef.current;
      const cpv = prerequisValidationsRef.current;
      if (dirtyRef.current && cq) {
        try { localStorage.setItem(`questionnaire_draft_${cq.id}`, JSON.stringify({ ...buildDraftPayload(cq, cpv), date_consentement_rgpd: cq.consentement_rgpd ? cq.date_consentement_rgpd || new Date().toISOString() : null, _savedAt: new Date().toISOString() })); }
        catch (e) { console.warn("Failed to save to localStorage", e); }
      }
    };
    const handleVisibilityChange = () => { if (document.visibilityState === "hidden") { void saveDraft({ silent: true }); saveToLocalStorage(); } };
    const handleBeforeUnload = () => saveToLocalStorage();
    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => { document.removeEventListener("visibilitychange", handleVisibilityChange); window.removeEventListener("beforeunload", handleBeforeUnload); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Restore from localStorage once
  useEffect(() => {
    if (!questionnaire || !initialLoadCompleteRef.current || localStorageRestoredRef.current) return;
    localStorageRestoredRef.current = true;
    try {
      const savedDraft = localStorage.getItem(`questionnaire_draft_${questionnaire.id}`);
      if (savedDraft) {
        const draft = JSON.parse(savedDraft);
        const draftTime = new Date(draft._savedAt).getTime();
        const dbTime = questionnaire.date_derniere_sauvegarde ? new Date(questionnaire.date_derniere_sauvegarde).getTime() : 0;
        if (draftTime > dbTime) {
          setQuestionnaire((prev) => prev ? { ...prev, prenom: draft.prenom ?? prev.prenom, nom: draft.nom ?? prev.nom, societe: draft.societe ?? prev.societe, fonction: draft.fonction ?? prev.fonction, experience_sujet: draft.experience_sujet ?? prev.experience_sujet, experience_details: draft.experience_details ?? prev.experience_details, lecture_programme: draft.lecture_programme ?? prev.lecture_programme, prerequis_validation: draft.prerequis_validation ?? prev.prerequis_validation, prerequis_details: draft.prerequis_details ?? prev.prerequis_details, competences_actuelles: draft.competences_actuelles ?? prev.competences_actuelles, competences_visees: draft.competences_visees ?? prev.competences_visees, lien_mission: draft.lien_mission ?? prev.lien_mission, niveau_actuel: draft.niveau_actuel ?? prev.niveau_actuel, niveau_motivation: draft.niveau_motivation ?? prev.niveau_motivation, contraintes_orga: draft.contraintes_orga ?? prev.contraintes_orga, besoins_accessibilite: draft.besoins_accessibilite ?? prev.besoins_accessibilite, necessite_amenagement: draft.necessite_amenagement ?? prev.necessite_amenagement, commentaires_libres: draft.commentaires_libres ?? prev.commentaires_libres, consentement_rgpd: draft.consentement_rgpd ?? prev.consentement_rgpd } : prev);
          if (draft.modalites_preferences) setPrerequisValidations(draft.modalites_preferences);
          dirtyRef.current = true;
          toast({ title: "Brouillon restauré", description: "Vos réponses non sauvegardées ont été récupérées." });
        }
        localStorage.removeItem(`questionnaire_draft_${questionnaire.id}`);
      }
    } catch (e) { console.warn("Failed to restore from localStorage", e); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [questionnaire?.id, loading]);

  const formatScheduleDate = (dateStr: string) => { try { return formatDateWithDayOfWeek(dateStr); } catch { return dateStr; } };
  const formatTime = (timeStr: string) => timeStr.slice(0, 5);

  return {
    token,
    loading,
    saving,
    submitting,
    error,
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
    setError,
    setLoading,
  };
}
