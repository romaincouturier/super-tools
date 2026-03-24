import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { rpc } from "@/lib/supabase-rpc";
import { useToast } from "@/hooks/use-toast";
import { formatTrainingDates } from "@/lib/dateFormatters";
import { assertTransition, evaluationMachine, type EvaluationStatus } from "@/lib/stateMachine";

// ─── Types ──────────────────────────────────────────────────────────

export type EvaluationRecord = {
  id: string;
  training_id: string;
  participant_id: string;
  token: string;
  etat: string;
  email: string | null;
  first_name: string | null;
  last_name: string | null;
  company: string | null;
  appreciation_generale: number | null;
  recommandation: string | null;
  objectifs_evaluation: { objectif: string; niveau: number }[] | null;
  objectif_prioritaire: string | null;
  delai_application: string | null;
  freins_application: string | null;
  rythme: string | null;
  equilibre_theorie_pratique: string | null;
  amelioration_suggeree: string | null;
  conditions_info_satisfaisantes: boolean | null;
  formation_adaptee_public: boolean | null;
  qualification_intervenant_adequate: boolean | null;
  appreciations_prises_en_compte: string | null;
  message_recommandation: string | null;
  consent_publication: boolean | null;
  remarques_libres: string | null;
  date_premiere_ouverture: string | null;
  date_soumission: string | null;
};

export type TrainingRecord = {
  training_name: string;
  start_date: string;
  end_date: string | null;
  objectives: string[] | null;
};

export type ObjectiveEvaluation = { objectif: string; niveau: number };

// ─── Hook ───────────────────────────────────────────────────────────

export function useEvaluationForm(token: string | undefined) {
  const { toast } = useToast();

  // Data state
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [evaluation, setEvaluation] = useState<EvaluationRecord | null>(null);
  const [training, setTraining] = useState<TrainingRecord | null>(null);

  // Form fields
  const [appreciationGenerale, setAppreciationGenerale] = useState<number | null>(null);
  const [recommandation, setRecommandation] = useState<string | null>(null);
  const [objectifsEvaluation, setObjectifsEvaluation] = useState<ObjectiveEvaluation[]>([]);
  const [objectifPrioritaire, setObjectifPrioritaire] = useState<string | null>(null);
  const [delaiApplication, setDelaiApplication] = useState<string | null>(null);
  const [freinsApplication, setFreinsApplication] = useState<string>("");
  const [rythme, setRythme] = useState<string | null>(null);
  const [equilibreTheoriePratique, setEquilibreTheoriePratique] = useState<string | null>(null);
  const [ameliorationSuggeree, setAmeliorationSuggeree] = useState<string>("");
  const [conditionsInfoSatisfaisantes, setConditionsInfoSatisfaisantes] = useState<boolean | null>(null);
  const [formationAdapteePublic, setFormationAdapteePublic] = useState<boolean | null>(null);
  const [qualificationIntervenantAdequate, setQualificationIntervenantAdequate] = useState<boolean | null>(null);
  const [appreciationsPrisesEnCompte, setAppreciationsPrisesEnCompte] = useState<string | null>(null);
  const [messageRecommandation, setMessageRecommandation] = useState<string>("");
  const [consentPublication, setConsentPublication] = useState<boolean | null>(null);
  const [remarquesLibres, setRemarquesLibres] = useState<string>("");

  const formattedDates = useMemo(() => {
    if (!training) return "";
    return formatTrainingDates(training.start_date, training.end_date);
  }, [training]);

  const fetchData = async () => {
    if (!token) {
      setError("Lien invalide : token manquant.");
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const { data: evArr, error: evErr } = await rpc.getEvaluationByToken(token);

      if (evErr || !evArr || evArr.length === 0) {
        throw evErr || new Error("Évaluation introuvable");
      }

      const evTyped = evArr[0] as unknown as EvaluationRecord;
      setEvaluation(evTyped);

      // Populate form state from existing data
      if (evTyped.appreciation_generale) setAppreciationGenerale(evTyped.appreciation_generale);
      if (evTyped.recommandation) setRecommandation(evTyped.recommandation);
      if (evTyped.objectifs_evaluation) setObjectifsEvaluation(evTyped.objectifs_evaluation);
      if (evTyped.objectif_prioritaire) setObjectifPrioritaire(evTyped.objectif_prioritaire);
      if (evTyped.delai_application) setDelaiApplication(evTyped.delai_application);
      if (evTyped.freins_application) setFreinsApplication(evTyped.freins_application);
      if (evTyped.rythme) setRythme(evTyped.rythme);
      if (evTyped.equilibre_theorie_pratique) setEquilibreTheoriePratique(evTyped.equilibre_theorie_pratique);
      if (evTyped.amelioration_suggeree) setAmeliorationSuggeree(evTyped.amelioration_suggeree);
      if (evTyped.conditions_info_satisfaisantes !== null) setConditionsInfoSatisfaisantes(evTyped.conditions_info_satisfaisantes);
      if (evTyped.formation_adaptee_public !== null) setFormationAdapteePublic(evTyped.formation_adaptee_public);
      if (evTyped.qualification_intervenant_adequate !== null) setQualificationIntervenantAdequate(evTyped.qualification_intervenant_adequate);
      if (evTyped.appreciations_prises_en_compte) setAppreciationsPrisesEnCompte(evTyped.appreciations_prises_en_compte);
      if (evTyped.message_recommandation) setMessageRecommandation(evTyped.message_recommandation);
      if (evTyped.consent_publication !== null) setConsentPublication(evTyped.consent_publication);
      if (evTyped.remarques_libres) setRemarquesLibres(evTyped.remarques_libres);

      // Fetch training (may be null for orphan evaluations)
      if (evTyped.training_id) {
        const { data: t, error: tErr } = await rpc.getTrainingPublicInfo(evTyped.training_id);

        if (!tErr && t) {
          setTraining(t as unknown as TrainingRecord);

          // Initialize objectives evaluation
          if (t.objectives && Array.isArray(t.objectives)) {
            const existingEvals = (evTyped.objectifs_evaluation || []) as ObjectiveEvaluation[];
            const objectivesWithEval = t.objectives.map((obj: string) => {
              const existing = existingEvals.find((e) => e.objectif === obj);
              return { objectif: obj, niveau: existing?.niveau || 0 };
            });
            setObjectifsEvaluation(objectivesWithEval);
          }
        }
      }

      // First open tracking
      if (!evTyped.date_premiere_ouverture) {
        const nowIso = new Date().toISOString();
        await rpc.updateEvaluationByToken(token, { date_premiere_ouverture: nowIso });
      }
    } catch (e: unknown) {
      console.error("Failed to load evaluation", e);
      const errorMsg = "Impossible d'ouvrir cette évaluation (lien invalide, expiré, ou accès refusé).";
      setError(errorMsg);
      // Fire-and-forget alert to admin
      supabase.functions.invoke("alert-form-error", {
        body: {
          formType: "evaluation",
          token,
          errorMessage: e instanceof Error ? e.message : errorMsg,
          userAgent: navigator.userAgent,
          url: window.location.href,
        },
      }).catch(() => {});
    } finally {
      setLoading(false);
    }
  };

  const handleObjectiveRating = (index: number, niveau: number) => {
    setObjectifsEvaluation((prev) =>
      prev.map((o, i) => (i === index ? { ...o, niveau } : o))
    );
  };

  const submit = async () => {
    if (!evaluation) return;

    // Validation
    if (appreciationGenerale === null) {
      toast({
        title: "Champ requis",
        description: "Veuillez indiquer votre appréciation générale.",
        variant: "destructive",
      });
      return;
    }

    if (!recommandation) {
      toast({
        title: "Champ requis",
        description: "Veuillez indiquer si vous recommanderiez cette formation.",
        variant: "destructive",
      });
      return;
    }

    setSubmitting(true);
    try {
      const nowIso = new Date().toISOString();

      assertTransition(evaluationMachine, form.evaluation.etat as EvaluationStatus, "soumis");

      const { error: upErr } = await rpc.updateEvaluationByToken(token!, {
        appreciation_generale: appreciationGenerale,
        recommandation,
        objectifs_evaluation: objectifsEvaluation,
        objectif_prioritaire: objectifPrioritaire,
        delai_application: delaiApplication,
        freins_application: freinsApplication || null,
        rythme,
        equilibre_theorie_pratique: equilibreTheoriePratique,
        amelioration_suggeree: ameliorationSuggeree || null,
        conditions_info_satisfaisantes: conditionsInfoSatisfaisantes,
        formation_adaptee_public: formationAdapteePublic,
        qualification_intervenant_adequate: qualificationIntervenantAdequate,
        appreciations_prises_en_compte: appreciationsPrisesEnCompte,
        message_recommandation: messageRecommandation || null,
        consent_publication: consentPublication,
        remarques_libres: remarquesLibres || null,
        etat: "soumis",
        date_soumission: nowIso,
      });

      if (upErr) throw upErr;

      // Trigger post-evaluation processing (certificate, emails, etc.)
      // Fire-and-forget: don't await to avoid edge function timeout blocking the UI
      supabase.functions.invoke("process-evaluation-submission", {
        body: { evaluationId: evaluation.id },
      }).catch((processError) => {
        console.error("Post-evaluation processing failed:", processError);
      });

      toast({
        title: "Merci !",
        description: "Votre évaluation a bien été enregistrée. Vous recevrez votre certificat par email.",
      });

      setEvaluation((prev) =>
        prev ? { ...prev, etat: "soumis", date_soumission: nowIso } : prev
      );
    } catch (e: unknown) {
      const errorDetail = e instanceof Error ? e.message : "Erreur inconnue";
      console.error("Submit failed — detail:", errorDetail, "full:", e);
      toast({
        title: "Erreur",
        description: `Impossible de soumettre l'évaluation. (${errorDetail}) Réessayez.`,
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

  return {
    // Data
    loading,
    submitting,
    error,
    evaluation,
    training,
    formattedDates,

    // Form fields
    appreciationGenerale,
    setAppreciationGenerale,
    recommandation,
    setRecommandation,
    objectifsEvaluation,
    objectifPrioritaire,
    setObjectifPrioritaire,
    delaiApplication,
    setDelaiApplication,
    freinsApplication,
    setFreinsApplication,
    rythme,
    setRythme,
    equilibreTheoriePratique,
    setEquilibreTheoriePratique,
    ameliorationSuggeree,
    setAmeliorationSuggeree,
    conditionsInfoSatisfaisantes,
    setConditionsInfoSatisfaisantes,
    formationAdapteePublic,
    setFormationAdapteePublic,
    qualificationIntervenantAdequate,
    setQualificationIntervenantAdequate,
    appreciationsPrisesEnCompte,
    setAppreciationsPrisesEnCompte,
    messageRecommandation,
    setMessageRecommandation,
    consentPublication,
    setConsentPublication,
    remarquesLibres,
    setRemarquesLibres,

    // Actions
    handleObjectiveRating,
    submit,
  };
}
