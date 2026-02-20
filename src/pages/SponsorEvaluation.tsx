import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Loader2, CheckCircle2, Calendar, Building2, User, Mail } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import supertiltLogo from "@/assets/supertilt-logo-anthracite-transparent.png";

type SponsorEvalRecord = {
  id: string;
  training_id: string;
  participant_id: string | null;
  token: string;
  etat: string;
  sponsor_email: string | null;
  sponsor_name: string | null;
  company: string | null;
  training_name: string | null;
  training_start_date: string | null;
  training_end_date: string | null;
  satisfaction_globale: number | null;
  attentes_satisfaites: string | null;
  objectifs_atteints: string | null;
  impact_competences: string | null;
  description_impact: string | null;
  organisation_satisfaisante: boolean | null;
  communication_satisfaisante: boolean | null;
  recommandation: string | null;
  message_recommandation: string | null;
  consent_publication: boolean | null;
  points_forts: string | null;
  axes_amelioration: string | null;
  commentaires_libres: string | null;
  date_premiere_ouverture: string | null;
  date_soumission: string | null;
};

type TrainingInfo = {
  training_name: string;
  start_date: string;
  end_date: string | null;
};

const SponsorEvaluation = () => {
  const { token } = useParams<{ token: string }>();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [record, setRecord] = useState<SponsorEvalRecord | null>(null);
  const [training, setTraining] = useState<TrainingInfo | null>(null);

  // Form state
  const [satisfactionGlobale, setSatisfactionGlobale] = useState<number | null>(null);
  const [attentesSatisfaites, setAttentesSatisfaites] = useState<string | null>(null);
  const [objectifsAtteints, setObjectifsAtteints] = useState<string | null>(null);
  const [impactCompetences, setImpactCompetences] = useState<string | null>(null);
  const [descriptionImpact, setDescriptionImpact] = useState("");
  const [organisationSatisfaisante, setOrganisationSatisfaisante] = useState<string | null>(null);
  const [communicationSatisfaisante, setCommunicationSatisfaisante] = useState<string | null>(null);
  const [recommandation, setRecommandation] = useState<string | null>(null);
  const [messageRecommandation, setMessageRecommandation] = useState("");
  const [consentPublication, setConsentPublication] = useState<string | null>(null);
  const [pointsForts, setPointsForts] = useState("");
  const [axesAmelioration, setAxesAmelioration] = useState("");
  const [commentairesLibres, setCommentairesLibres] = useState("");

  const formattedDates = useMemo(() => {
    if (!training) return "";
    const start = format(new Date(training.start_date), "d MMMM yyyy", { locale: fr });
    if (training.end_date && training.end_date !== training.start_date) {
      const end = format(new Date(training.end_date), "d MMMM yyyy", { locale: fr });
      return `du ${start} au ${end}`;
    }
    return `le ${start}`;
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
      const { data: ev, error: evErr } = await (supabase as any)
        .from("sponsor_cold_evaluations")
        .select("*")
        .eq("token", token)
        .single();

      if (evErr || !ev) {
        throw evErr || new Error("Évaluation introuvable");
      }

      const evTyped = ev as SponsorEvalRecord;
      setRecord(evTyped);

      // Populate form state from existing data
      if (evTyped.satisfaction_globale) setSatisfactionGlobale(evTyped.satisfaction_globale);
      if (evTyped.attentes_satisfaites) setAttentesSatisfaites(evTyped.attentes_satisfaites);
      if (evTyped.objectifs_atteints) setObjectifsAtteints(evTyped.objectifs_atteints);
      if (evTyped.impact_competences) setImpactCompetences(evTyped.impact_competences);
      if (evTyped.description_impact) setDescriptionImpact(evTyped.description_impact);
      if (evTyped.organisation_satisfaisante !== null) setOrganisationSatisfaisante(evTyped.organisation_satisfaisante ? "oui" : "non");
      if (evTyped.communication_satisfaisante !== null) setCommunicationSatisfaisante(evTyped.communication_satisfaisante ? "oui" : "non");
      if (evTyped.recommandation) setRecommandation(evTyped.recommandation);
      if (evTyped.message_recommandation) setMessageRecommandation(evTyped.message_recommandation);
      if (evTyped.consent_publication !== null) setConsentPublication(evTyped.consent_publication ? "oui" : "non");
      if (evTyped.points_forts) setPointsForts(evTyped.points_forts);
      if (evTyped.axes_amelioration) setAxesAmelioration(evTyped.axes_amelioration);
      if (evTyped.commentaires_libres) setCommentairesLibres(evTyped.commentaires_libres);

      // Read training info from the evaluation record (stored at creation)
      if (evTyped.training_name && evTyped.training_start_date) {
        setTraining({
          training_name: evTyped.training_name,
          start_date: evTyped.training_start_date,
          end_date: evTyped.training_end_date,
        });
      } else {
        // Fallback for older records: try fetching from trainings table
        const { data: t } = await supabase
          .from("trainings")
          .select("training_name,start_date,end_date")
          .eq("id", evTyped.training_id)
          .single();

        if (t) {
          setTraining(t as unknown as TrainingInfo);
        }
      }

      // First open tracking
      if (!evTyped.date_premiere_ouverture) {
        await (supabase as any)
          .from("sponsor_cold_evaluations")
          .update({ date_premiere_ouverture: new Date().toISOString() })
          .eq("id", evTyped.id);
      }
    } catch (e: unknown) {
      console.error("Failed to load sponsor evaluation", e);
      setError("Impossible d'ouvrir cette évaluation (lien invalide, expiré, ou accès refusé).");
    } finally {
      setLoading(false);
    }
  };

  const submit = async () => {
    if (!record) return;

    if (satisfactionGlobale === null) {
      toast({
        title: "Champ requis",
        description: "Veuillez indiquer votre satisfaction globale.",
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

      const { error: upErr } = await (supabase as any)
        .from("sponsor_cold_evaluations")
        .update({
          satisfaction_globale: satisfactionGlobale,
          attentes_satisfaites: attentesSatisfaites,
          objectifs_atteints: objectifsAtteints,
          impact_competences: impactCompetences,
          description_impact: descriptionImpact || null,
          organisation_satisfaisante: organisationSatisfaisante === "oui",
          communication_satisfaisante: communicationSatisfaisante === "oui",
          recommandation,
          message_recommandation: messageRecommandation || null,
          consent_publication: consentPublication === "oui",
          points_forts: pointsForts || null,
          axes_amelioration: axesAmelioration || null,
          commentaires_libres: commentairesLibres || null,
          etat: "soumis",
          date_soumission: nowIso,
        })
        .eq("id", record.id);

      if (upErr) throw upErr;

      toast({
        title: "Merci !",
        description: "Votre évaluation a bien été enregistrée.",
      });

      setRecord((prev) =>
        prev ? { ...prev, etat: "soumis", date_soumission: nowIso } : prev
      );
    } catch (e: unknown) {
      console.error("Submit failed", e);
      toast({
        title: "Erreur",
        description: "Impossible de soumettre l'évaluation. Réessayez.",
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
            <img src={supertiltLogo} alt="SuperTilt" className="h-12 mx-auto mb-4" />
            <CardTitle className="text-destructive">Accès impossible</CardTitle>
          </CardHeader>
          <CardContent className="text-center text-muted-foreground">
            {error}
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!record) return null;

  // Already submitted view
  if (record.etat === "soumis" && record.date_soumission) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <Card className="max-w-md w-full">
          <CardHeader className="text-center">
            <img src={supertiltLogo} alt="SuperTilt" className="h-12 mx-auto mb-4" />
            <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 className="w-8 h-8 text-green-600" />
            </div>
            <CardTitle>Merci pour votre retour !</CardTitle>
            <CardDescription>
              Vous avez envoyé votre évaluation pour la formation <strong>{training.training_name}</strong> le{" "}
              {format(new Date(record.date_soumission), "d MMMM yyyy à HH:mm", { locale: fr })}.
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center">
            <p className="text-muted-foreground">
              Vos retours sont précieux et nous aident à améliorer continuellement nos formations.
            </p>
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
              Évaluation à froid de la formation
            </h1>
            <p className="text-muted-foreground mt-1">{training.training_name}</p>
          </div>
        </div>

        {/* Informations générales */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Informations</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {record.sponsor_email && (
                <div className="flex items-center gap-2 text-sm">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  <span className="text-muted-foreground">Email :</span>
                  <span className="font-medium">{record.sponsor_email}</span>
                </div>
              )}
              {record.sponsor_name && (
                <div className="flex items-center gap-2 text-sm">
                  <User className="h-4 w-4 text-muted-foreground" />
                  <span className="text-muted-foreground">Nom :</span>
                  <span className="font-medium">{record.sponsor_name}</span>
                </div>
              )}
              {record.company && (
                <div className="flex items-center gap-2 text-sm">
                  <Building2 className="h-4 w-4 text-muted-foreground" />
                  <span className="text-muted-foreground">Entreprise :</span>
                  <span className="font-medium">{record.company}</span>
                </div>
              )}
            </div>
            <div className="flex items-center gap-2 text-sm pt-2 border-t">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <span className="text-muted-foreground">Formation :</span>
              <span className="font-medium">{formattedDates}</span>
            </div>
          </CardContent>
        </Card>

        {/* Section 1: Satisfaction globale */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Satisfaction globale</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-3">
              <Label>
                Quelle est votre satisfaction globale concernant cette formation ?
                <span className="text-destructive ml-1">*</span>
              </Label>
              <p className="text-xs text-muted-foreground">5 : très satisfait, 1 : insatisfait</p>
              <div className="flex gap-2 flex-wrap">
                {[5, 4, 3, 2, 1].map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setSatisfactionGlobale(n)}
                    className={`flex items-center justify-center w-12 h-12 rounded-lg border-2 transition-all ${
                      satisfactionGlobale === n
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
              <Label>La formation a-t-elle répondu à vos attentes ?</Label>
              <RadioGroup value={attentesSatisfaites || ""} onValueChange={setAttentesSatisfaites}>
                <div className="flex flex-wrap gap-4">
                  {[
                    { value: "oui", label: "Oui" },
                    { value: "partiellement", label: "Partiellement" },
                    { value: "non", label: "Non" },
                  ].map((opt) => (
                    <div key={opt.value} className="flex items-center gap-2">
                      <RadioGroupItem value={opt.value} id={`attentes-${opt.value}`} />
                      <Label htmlFor={`attentes-${opt.value}`} className="font-normal cursor-pointer">
                        {opt.label}
                      </Label>
                    </div>
                  ))}
                </div>
              </RadioGroup>
            </div>
          </CardContent>
        </Card>

        {/* Section 2: Impact et résultats */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Impact et résultats</CardTitle>
            <CardDescription>
              Évaluez l'impact de la formation sur les compétences de vos collaborateurs
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-3">
              <Label>Les objectifs de la formation ont-ils été atteints ?</Label>
              <RadioGroup value={objectifsAtteints || ""} onValueChange={setObjectifsAtteints}>
                <div className="flex flex-wrap gap-4">
                  {[
                    { value: "oui", label: "Oui" },
                    { value: "partiellement", label: "Partiellement" },
                    { value: "non", label: "Non" },
                  ].map((opt) => (
                    <div key={opt.value} className="flex items-center gap-2">
                      <RadioGroupItem value={opt.value} id={`obj-${opt.value}`} />
                      <Label htmlFor={`obj-${opt.value}`} className="font-normal cursor-pointer">
                        {opt.label}
                      </Label>
                    </div>
                  ))}
                </div>
              </RadioGroup>
            </div>

            <div className="space-y-3">
              <Label>Avez-vous observé un impact sur les compétences des participants ?</Label>
              <RadioGroup value={impactCompetences || ""} onValueChange={setImpactCompetences}>
                <div className="flex flex-wrap gap-4">
                  {[
                    { value: "oui", label: "Oui" },
                    { value: "partiellement", label: "Partiellement" },
                    { value: "non", label: "Non" },
                    { value: "trop_tot", label: "Trop tôt pour le dire" },
                  ].map((opt) => (
                    <div key={opt.value} className="flex items-center gap-2">
                      <RadioGroupItem value={opt.value} id={`impact-${opt.value}`} />
                      <Label htmlFor={`impact-${opt.value}`} className="font-normal cursor-pointer">
                        {opt.label}
                      </Label>
                    </div>
                  ))}
                </div>
              </RadioGroup>
            </div>

            <div className="space-y-2">
              <Label>Pouvez-vous décrire les impacts observés ?</Label>
              <Textarea
                value={descriptionImpact}
                onChange={(e) => setDescriptionImpact(e.target.value)}
                placeholder="Décrivez les changements ou améliorations constatés..."
                rows={3}
              />
            </div>
          </CardContent>
        </Card>

        {/* Section 3: Organisation et communication */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Organisation et communication</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-3">
              <Label>Les conditions d'organisation étaient-elles satisfaisantes ?</Label>
              <RadioGroup value={organisationSatisfaisante || ""} onValueChange={setOrganisationSatisfaisante}>
                <div className="flex flex-wrap gap-4">
                  {[
                    { value: "oui", label: "Oui" },
                    { value: "non", label: "Non" },
                  ].map((opt) => (
                    <div key={opt.value} className="flex items-center gap-2">
                      <RadioGroupItem value={opt.value} id={`orga-${opt.value}`} />
                      <Label htmlFor={`orga-${opt.value}`} className="font-normal cursor-pointer">
                        {opt.label}
                      </Label>
                    </div>
                  ))}
                </div>
              </RadioGroup>
            </div>

            <div className="space-y-3">
              <Label>La communication avec le formateur était-elle satisfaisante ?</Label>
              <RadioGroup value={communicationSatisfaisante || ""} onValueChange={setCommunicationSatisfaisante}>
                <div className="flex flex-wrap gap-4">
                  {[
                    { value: "oui", label: "Oui" },
                    { value: "non", label: "Non" },
                  ].map((opt) => (
                    <div key={opt.value} className="flex items-center gap-2">
                      <RadioGroupItem value={opt.value} id={`comm-${opt.value}`} />
                      <Label htmlFor={`comm-${opt.value}`} className="font-normal cursor-pointer">
                        {opt.label}
                      </Label>
                    </div>
                  ))}
                </div>
              </RadioGroup>
            </div>
          </CardContent>
        </Card>

        {/* Section 4: Recommandation */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Recommandation</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
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
                    { value: "peut_etre", label: "Peut-être" },
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

            <div className="space-y-2">
              <Label>Si oui, souhaitez-vous laisser un témoignage ?</Label>
              <Textarea
                value={messageRecommandation}
                onChange={(e) => setMessageRecommandation(e.target.value)}
                placeholder="Votre témoignage..."
                rows={3}
              />
            </div>

            {messageRecommandation && (
              <div className="space-y-3">
                <Label>Acceptez-vous que ce témoignage soit publié (de manière anonyme) ?</Label>
                <RadioGroup value={consentPublication || ""} onValueChange={setConsentPublication}>
                  <div className="flex flex-wrap gap-4">
                    {[
                      { value: "oui", label: "Oui" },
                      { value: "non", label: "Non" },
                    ].map((opt) => (
                      <div key={opt.value} className="flex items-center gap-2">
                        <RadioGroupItem value={opt.value} id={`consent-${opt.value}`} />
                        <Label htmlFor={`consent-${opt.value}`} className="font-normal cursor-pointer">
                          {opt.label}
                        </Label>
                      </div>
                    ))}
                  </div>
                </RadioGroup>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Section 5: Amélioration */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Points forts et axes d'amélioration</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Quels sont les points forts de cette formation ?</Label>
              <Textarea
                value={pointsForts}
                onChange={(e) => setPointsForts(e.target.value)}
                placeholder="Ce que vous avez particulièrement apprécié..."
                rows={3}
              />
            </div>

            <div className="space-y-2">
              <Label>Quels axes d'amélioration suggérez-vous ?</Label>
              <Textarea
                value={axesAmelioration}
                onChange={(e) => setAxesAmelioration(e.target.value)}
                placeholder="Vos suggestions d'amélioration..."
                rows={3}
              />
            </div>

            <div className="space-y-2">
              <Label>Commentaires libres</Label>
              <Textarea
                value={commentairesLibres}
                onChange={(e) => setCommentairesLibres(e.target.value)}
                placeholder="Tout autre commentaire que vous souhaitez partager..."
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
            className="px-8"
          >
            {submitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Envoi en cours...
              </>
            ) : (
              "Envoyer mon évaluation"
            )}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default SponsorEvaluation;
