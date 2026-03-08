import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { rpc } from "@/lib/supabase-rpc";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Loader2, CheckCircle2, Star, Calendar, Building2, User, Mail } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { formatTrainingDates, formatDateWithTime } from "@/lib/dateFormatters";
import supertiltLogo from "@/assets/supertilt-logo-anthracite-transparent.png";

type EvaluationRecord = {
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

type TrainingRecord = {
  training_name: string;
  start_date: string;
  end_date: string | null;
  objectives: string[] | null;
};

const Evaluation = () => {
  const { token } = useParams<{ token: string }>();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [evaluation, setEvaluation] = useState<EvaluationRecord | null>(null);
  const [training, setTraining] = useState<TrainingRecord | null>(null);

  const [appreciationGenerale, setAppreciationGenerale] = useState<number | null>(null);
  const [recommandation, setRecommandation] = useState<string | null>(null);
  const [objectifsEvaluation, setObjectifsEvaluation] = useState<{ objectif: string; niveau: number }[]>([]);
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

      // Fetch training
      const { data: t, error: tErr } = await rpc.getTrainingPublicInfo(evTyped.training_id);

      if (!tErr && t) {
        setTraining(t as unknown as TrainingRecord);

        // Initialize objectives evaluation
        if (t.objectives && Array.isArray(t.objectives)) {
          const existingEvals = (evTyped.objectifs_evaluation || []) as { objectif: string; niveau: number }[];
          const objectivesWithEval = t.objectives.map((obj: string) => {
            const existing = existingEvals.find((e) => e.objectif === obj);
            return { objectif: obj, niveau: existing?.niveau || 0 };
          });
          setObjectifsEvaluation(objectivesWithEval);
        }
      }

      // First open tracking
      if (!evTyped.date_premiere_ouverture) {
        const nowIso = new Date().toISOString();
        await rpc.updateEvaluationByToken(token, { date_premiere_ouverture: nowIso });
      }
    } catch (e: any) {
      console.error("Failed to load evaluation", e);
      const errorMsg = "Impossible d'ouvrir cette évaluation (lien invalide, expiré, ou accès refusé).";
      setError(errorMsg);
      // Fire-and-forget alert to admin
      supabase.functions.invoke("alert-form-error", {
        body: {
          formType: "evaluation",
          token,
          errorMessage: e?.message || e?.code || errorMsg,
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

      const { error: upErr } = await (supabase.rpc as any)("update_evaluation_by_token", {
        p_token: token!,
        p_data: {
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
        },
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
    } catch (e: any) {
      const errorDetail = e?.message || e?.code || JSON.stringify(e);
      console.error("Submit failed — detail:", errorDetail, "full:", e);
      toast({
        title: "Erreur",
        description: `Impossible de soumettre l'évaluation. ${errorDetail ? `(${errorDetail})` : ""} Réessayez.`,
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

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center space-y-4">
          <Loader2 className="h-10 w-10 animate-spin text-primary mx-auto" />
          <p className="text-muted-foreground">Chargement de l'évaluation...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <Card className="max-w-md w-full">
          <CardHeader className="text-center">
            <img
              src={supertiltLogo}
              alt="SuperTilt"
              className="h-12 mx-auto mb-4"
            />
            <CardTitle className="text-destructive">Accès impossible</CardTitle>
          </CardHeader>
          <CardContent className="text-center text-muted-foreground">
            {error}
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!evaluation || !training) return null;

  // Already submitted view
  if (evaluation.etat === "soumis" && evaluation.date_soumission) {
    const trainingSummaryUrl = `/formation-info/${evaluation.training_id}`;

    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <Card className="max-w-md w-full">
          <CardHeader className="text-center">
            <img
              src={supertiltLogo}
              alt="SuperTilt"
              className="h-12 mx-auto mb-4"
            />
            <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 className="w-8 h-8 text-green-600" />
            </div>
            <CardTitle>Merci pour votre retour !</CardTitle>
            <CardDescription>
              Vous avez envoyé votre évaluation pour la formation <strong>{training.training_name}</strong> le{" "}
              {formatDateWithTime(evaluation.date_soumission)}.
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center space-y-4">
            <p className="text-muted-foreground">
              Votre certificat de réalisation vous sera envoyé par email.
            </p>
            <p className="text-muted-foreground">
              Les supports de la formation restent disponibles sur la page de synthèse de la formation.
            </p>
            <Link
              to={trainingSummaryUrl}
              className="inline-block bg-primary text-primary-foreground px-4 py-2 rounded-md hover:bg-primary/90 transition-colors"
            >
              Voir la page de la formation
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Header */}
        <div className="text-center space-y-4">
          <img src={supertiltLogo} alt="SuperTilt" className="h-14 mx-auto" />
          <div>
            <h1 className="text-2xl font-bold text-foreground">
              Questionnaire d'évaluation de formation
            </h1>
            <p className="text-muted-foreground mt-1">{training.training_name}</p>
          </div>
        </div>

        {/* Informations générales */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Informations générales</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="flex items-center gap-2 text-sm">
                <Mail className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">Email :</span>
                <span className="font-medium">{evaluation.email || "—"}</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <User className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">Prénom :</span>
                <span className="font-medium">{evaluation.first_name || "—"}</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <User className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">Nom :</span>
                <span className="font-medium">{evaluation.last_name || "—"}</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <Building2 className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">Entreprise :</span>
                <span className="font-medium">{evaluation.company || "—"}</span>
              </div>
            </div>
            <div className="flex items-center gap-2 text-sm pt-2 border-t">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <span className="text-muted-foreground">Formation :</span>
              <span className="font-medium">{formattedDates}</span>
            </div>
          </CardContent>
        </Card>

        {/* Évaluation globale */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Évaluation globale</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-3">
              <Label>
                Quelle est votre appréciation générale de cette formation ?
                <span className="text-destructive ml-1">*</span>
              </Label>
              <p className="text-xs text-muted-foreground">5 : très satisfait, 1 : insatisfait</p>
              <div className="flex gap-2 flex-wrap">
                {[5, 4, 3, 2, 1].map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setAppreciationGenerale(n)}
                    className={`flex items-center justify-center w-12 h-12 rounded-lg border-2 transition-all ${
                      appreciationGenerale === n
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-gray-200 hover:border-gray-300"
                    }`}
                  >
                    <span className="font-semibold">{n}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-3">
              <Label>
                Recommanderiez-vous cette formation ?
                <span className="text-destructive ml-1">*</span>
              </Label>
              <RadioGroup value={recommandation || ""} onValueChange={setRecommandation}>
                <div className="flex flex-wrap gap-4">
                  {[
                    { value: "oui", label: "Oui" },
                    { value: "non", label: "Non" },
                    { value: "peut-etre", label: "Peut-être" },
                  ].map((opt) => (
                    <div key={opt.value} className="flex items-center gap-2">
                      <RadioGroupItem value={opt.value} id={`reco-${opt.value}`} />
                      <Label htmlFor={`reco-${opt.value}`} className="font-normal cursor-pointer">
                        {opt.label}
                      </Label>
                    </div>
                  ))}
                </div>
              </RadioGroup>
            </div>
          </CardContent>
        </Card>

        {/* Atteinte des objectifs pédagogiques */}
        {training.objectives && training.objectives.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Atteinte des objectifs pédagogiques</CardTitle>
              <CardDescription>
                Pour chaque objectif, indiquez votre niveau d'atteinte (1 = Non atteint, 5 = Totalement atteint)
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {objectifsEvaluation.map((obj, index) => (
                <div key={index} className="space-y-2 pb-4 border-b last:border-0">
                  <Label className="text-sm">{obj.objectif}</Label>
                  <div className="flex gap-2">
                    {[5, 4, 3, 2, 1].map((n) => (
                      <button
                        key={n}
                        type="button"
                        onClick={() => handleObjectiveRating(index, n)}
                        className={`flex items-center justify-center w-10 h-10 rounded-lg border-2 transition-all ${
                          obj.niveau === n
                            ? "border-primary bg-primary/10 text-primary"
                            : "border-gray-200 hover:border-gray-300"
                        }`}
                      >
                        <span className="font-medium text-sm">{n}</span>
                      </button>
                    ))}
                  </div>
                </div>
              ))}

              <div className="space-y-3 pt-2">
                <Label>
                  Parmi ces objectifs, lequel allez-vous appliquer en premier dans votre pratique professionnelle ?
                </Label>
                <RadioGroup value={objectifPrioritaire || ""} onValueChange={setObjectifPrioritaire}>
                  <div className="space-y-2">
                    {training.objectives.map((obj, index) => (
                      <div key={index} className="flex items-start gap-2">
                        <RadioGroupItem value={obj} id={`obj-prio-${index}`} className="mt-1" />
                        <Label htmlFor={`obj-prio-${index}`} className="font-normal cursor-pointer text-sm">
                          {obj}
                        </Label>
                      </div>
                    ))}
                  </div>
                </RadioGroup>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Application pratique */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Application pratique</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-3">
              <Label>Dans combien de temps pensez-vous appliquer ces nouvelles compétences ?</Label>
              <RadioGroup value={delaiApplication || ""} onValueChange={setDelaiApplication}>
                <div className="space-y-2">
                  {[
                    { value: "cette_semaine", label: "Cette semaine" },
                    { value: "ce_mois", label: "Ce mois-ci" },
                    { value: "trois_mois", label: "Dans les 3 mois" },
                    { value: "incertain", label: "Application incertaine" },
                  ].map((opt) => (
                    <div key={opt.value} className="flex items-center gap-2">
                      <RadioGroupItem value={opt.value} id={`delai-${opt.value}`} />
                      <Label htmlFor={`delai-${opt.value}`} className="font-normal cursor-pointer">
                        {opt.label}
                      </Label>
                    </div>
                  ))}
                </div>
              </RadioGroup>
            </div>

            <div className="space-y-2">
              <Label htmlFor="freins">
                Qu'est-ce qui pourrait vous empêcher de mettre en pratique ces compétences ?
              </Label>
              <p className="text-xs text-muted-foreground">Optionnel</p>
              <Textarea
                id="freins"
                value={freinsApplication}
                onChange={(e) => setFreinsApplication(e.target.value)}
                placeholder="Indiquez les éventuels freins..."
                rows={3}
              />
            </div>
          </CardContent>
        </Card>

        {/* Qualité pédagogique */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Qualité pédagogique</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-3">
              <Label>Le rythme de la formation était-il adapté ?</Label>
              <RadioGroup value={rythme || ""} onValueChange={setRythme}>
                <div className="flex flex-wrap gap-4">
                  {[
                    { value: "trop_lent", label: "Trop lent" },
                    { value: "adapte", label: "Adapté" },
                    { value: "trop_rapide", label: "Trop rapide" },
                  ].map((opt) => (
                    <div key={opt.value} className="flex items-center gap-2">
                      <RadioGroupItem value={opt.value} id={`rythme-${opt.value}`} />
                      <Label htmlFor={`rythme-${opt.value}`} className="font-normal cursor-pointer">
                        {opt.label}
                      </Label>
                    </div>
                  ))}
                </div>
              </RadioGroup>
            </div>

            <div className="space-y-3">
              <Label>L'équilibre entre théorie et pratique était-il satisfaisant ?</Label>
              <RadioGroup value={equilibreTheoriePratique || ""} onValueChange={setEquilibreTheoriePratique}>
                <div className="flex flex-wrap gap-4">
                  {[
                    { value: "trop_theorique", label: "Trop théorique" },
                    { value: "equilibre", label: "Équilibré" },
                    { value: "pas_assez_structure", label: "Pas assez structuré" },
                  ].map((opt) => (
                    <div key={opt.value} className="flex items-center gap-2">
                      <RadioGroupItem value={opt.value} id={`equilibre-${opt.value}`} />
                      <Label htmlFor={`equilibre-${opt.value}`} className="font-normal cursor-pointer">
                        {opt.label}
                      </Label>
                    </div>
                  ))}
                </div>
              </RadioGroup>
            </div>

            <div className="space-y-2">
              <Label htmlFor="amelioration">
                Si vous deviez améliorer UN seul élément de cette formation, lequel serait-ce ?
              </Label>
              <Textarea
                id="amelioration"
                value={ameliorationSuggeree}
                onChange={(e) => setAmeliorationSuggeree(e.target.value)}
                placeholder="Votre suggestion..."
                rows={2}
              />
            </div>
          </CardContent>
        </Card>

        {/* Conformité et organisation */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Conformité et organisation</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-3">
              <Label>
                Les conditions d'information des stagiaires sur l'offre de formation, ses délais d'accès et les résultats obtenus étaient-ils satisfaisants ?
              </Label>
              <RadioGroup
                value={conditionsInfoSatisfaisantes === null ? "" : conditionsInfoSatisfaisantes ? "oui" : "non"}
                onValueChange={(v) => setConditionsInfoSatisfaisantes(v === "oui")}
              >
                <div className="flex gap-4">
                  <div className="flex items-center gap-2">
                    <RadioGroupItem value="oui" id="conditions-oui" />
                    <Label htmlFor="conditions-oui" className="font-normal cursor-pointer">Oui</Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <RadioGroupItem value="non" id="conditions-non" />
                    <Label htmlFor="conditions-non" className="font-normal cursor-pointer">Non</Label>
                  </div>
                </div>
              </RadioGroup>
            </div>

            <div className="space-y-3">
              <Label>Cette formation était-elle adaptée au public ?</Label>
              <RadioGroup
                value={formationAdapteePublic === null ? "" : formationAdapteePublic ? "oui" : "non"}
                onValueChange={(v) => setFormationAdapteePublic(v === "oui")}
              >
                <div className="flex gap-4">
                  <div className="flex items-center gap-2">
                    <RadioGroupItem value="oui" id="adaptee-oui" />
                    <Label htmlFor="adaptee-oui" className="font-normal cursor-pointer">Oui</Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <RadioGroupItem value="non" id="adaptee-non" />
                    <Label htmlFor="adaptee-non" className="font-normal cursor-pointer">Non</Label>
                  </div>
                </div>
              </RadioGroup>
            </div>

            <div className="space-y-3">
              <Label>La qualification professionnelle de l'intervenant était-elle adéquate ?</Label>
              <RadioGroup
                value={qualificationIntervenantAdequate === null ? "" : qualificationIntervenantAdequate ? "oui" : "non"}
                onValueChange={(v) => setQualificationIntervenantAdequate(v === "oui")}
              >
                <div className="flex gap-4">
                  <div className="flex items-center gap-2">
                    <RadioGroupItem value="oui" id="qualif-oui" />
                    <Label htmlFor="qualif-oui" className="font-normal cursor-pointer">Oui</Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <RadioGroupItem value="non" id="qualif-non" />
                    <Label htmlFor="qualif-non" className="font-normal cursor-pointer">Non</Label>
                  </div>
                </div>
              </RadioGroup>
            </div>

            <div className="space-y-3">
              <Label>Les appréciations rendues par les stagiaires ont-elles été prises en compte ?</Label>
              <RadioGroup
                value={appreciationsPrisesEnCompte || ""}
                onValueChange={setAppreciationsPrisesEnCompte}
              >
                <div className="flex flex-wrap gap-4">
                  <div className="flex items-center gap-2">
                    <RadioGroupItem value="oui" id="appreciations-oui" />
                    <Label htmlFor="appreciations-oui" className="font-normal cursor-pointer">Oui</Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <RadioGroupItem value="non" id="appreciations-non" />
                    <Label htmlFor="appreciations-non" className="font-normal cursor-pointer">Non</Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <RadioGroupItem value="sans_objet" id="appreciations-sans" />
                    <Label htmlFor="appreciations-sans" className="font-normal cursor-pointer">Sans objet</Label>
                  </div>
                </div>
              </RadioGroup>
            </div>
          </CardContent>
        </Card>

        {/* Témoignage et recommandation */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Témoignage et recommandation</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="message-reco">
                Quel message de recommandation pouvez-vous me partager ?
              </Label>
              <p className="text-xs text-muted-foreground">
                Il sera publié sur le site Web www.supertilt.fr (2-3 phrases maximum)
              </p>
              <Textarea
                id="message-reco"
                value={messageRecommandation}
                onChange={(e) => setMessageRecommandation(e.target.value)}
                placeholder="Votre témoignage..."
                rows={3}
              />
            </div>

            <div className="space-y-3">
              <Label>
                Je consens à ce que ma recommandation soit publiée en mon nom sur le site SuperTilt.fr
              </Label>
              <RadioGroup
                value={consentPublication === null ? "" : consentPublication ? "oui" : "non"}
                onValueChange={(v) => setConsentPublication(v === "oui")}
              >
                <div className="space-y-2">
                  <div className="flex items-start gap-2">
                    <RadioGroupItem value="oui" id="consent-oui" className="mt-1" />
                    <Label htmlFor="consent-oui" className="font-normal cursor-pointer text-sm">
                      Oui, j'accepte la publication (format : {evaluation.first_name} {evaluation.last_name?.[0]}. - {evaluation.company || "Entreprise"})
                    </Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <RadioGroupItem value="non" id="consent-non" />
                    <Label htmlFor="consent-non" className="font-normal cursor-pointer text-sm">
                      Non, je veux rester anonyme
                    </Label>
                  </div>
                </div>
              </RadioGroup>
            </div>

            <div className="space-y-2">
              <Label htmlFor="remarques">
                Avez-vous une remarque à partager (zone de libre expression) ?
              </Label>
              <p className="text-xs text-muted-foreground">Optionnel</p>
              <Textarea
                id="remarques"
                value={remarquesLibres}
                onChange={(e) => setRemarquesLibres(e.target.value)}
                placeholder="Vos remarques..."
                rows={3}
              />
            </div>
          </CardContent>
        </Card>

        {/* Submit */}
        <div className="flex justify-center pb-8">
          <Button
            size="lg"
            onClick={submit}
            disabled={submitting}
            className="min-w-[200px]"
          >
            {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Envoyer mon évaluation
          </Button>
        </div>

        {/* Footer */}
        <div className="text-center text-xs text-muted-foreground pb-8">
          <Link to="/politique-confidentialite" className="hover:underline">
            Politique de confidentialité
          </Link>
        </div>
      </div>
    </div>
  );
};

export default Evaluation;
