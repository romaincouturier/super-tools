import { useParams, Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { VoiceTextarea } from "@/components/ui/voice-textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Loader2, CheckCircle2, Calendar, Building2, User, Mail } from "lucide-react";
import { formatDateWithTime } from "@/lib/dateFormatters";
import supertiltLogo from "@/assets/supertilt-logo-anthracite-transparent.png";
import { useEvaluationForm } from "@/hooks/useEvaluationForm";

const Evaluation = () => {
  const { token } = useParams<{ token: string }>();
  const form = useEvaluationForm(token);

  if (form.loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center space-y-4">
          <Loader2 className="h-10 w-10 animate-spin text-primary mx-auto" />
          <p className="text-muted-foreground">Chargement de l'évaluation...</p>
        </div>
      </div>
    );
  }

  if (form.error) {
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
            {form.error}
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!form.evaluation) return null;

  // Already submitted view
  if (form.evaluation.etat === "soumis" && form.evaluation.date_soumission) {
    const trainingSummaryUrl = form.evaluation.training_id ? `/formation-info/${form.evaluation.training_id}` : null;

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
              Vous avez envoyé votre évaluation{form.training ? <> pour la formation <strong>{form.training.training_name}</strong></> : ""} le{" "}
              {formatDateWithTime(form.evaluation.date_soumission)}.
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center space-y-4">
            <p className="text-muted-foreground">
              Votre certificat de réalisation vous sera envoyé par email.
            </p>
            {trainingSummaryUrl && (
              <>
                <p className="text-muted-foreground">
                  Les supports de la formation restent disponibles sur la page de synthèse de la formation.
                </p>
                <Link
                  to={trainingSummaryUrl}
                  className="inline-block bg-primary text-primary-foreground px-4 py-2 rounded-md hover:bg-primary/90 transition-colors"
                >
                  Voir la page de la formation
                </Link>
              </>
            )}
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
            {form.training && <p className="text-muted-foreground mt-1">{form.training.training_name}</p>}
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
                <span className="font-medium">{form.evaluation.email || "—"}</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <User className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">Prénom :</span>
                <span className="font-medium">{form.evaluation.first_name || "—"}</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <User className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">Nom :</span>
                <span className="font-medium">{form.evaluation.last_name || "—"}</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <Building2 className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">Entreprise :</span>
                <span className="font-medium">{form.evaluation.company || "—"}</span>
              </div>
            </div>
            {form.formattedDates && (
              <div className="flex items-center gap-2 text-sm pt-2 border-t">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">Formation :</span>
                <span className="font-medium">{form.formattedDates}</span>
              </div>
            )}
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
                    onClick={() => form.setAppreciationGenerale(n)}
                    className={`flex items-center justify-center w-12 h-12 rounded-lg border-2 transition-all ${
                      form.appreciationGenerale === n
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
              <RadioGroup value={form.recommandation || ""} onValueChange={form.setRecommandation}>
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
        {form.training?.objectives && form.training.objectives.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Atteinte des objectifs pédagogiques</CardTitle>
              <CardDescription>
                Pour chaque objectif, indiquez votre niveau d'atteinte (1 = Non atteint, 5 = Totalement atteint)
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {form.objectifsEvaluation.map((obj, index) => (
                <div key={index} className="space-y-2 pb-4 border-b last:border-0">
                  <Label className="text-sm">{obj.objectif}</Label>
                  <div className="flex gap-2">
                    {[5, 4, 3, 2, 1].map((n) => (
                      <button
                        key={n}
                        type="button"
                        onClick={() => form.handleObjectiveRating(index, n)}
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
                <RadioGroup value={form.objectifPrioritaire || ""} onValueChange={form.setObjectifPrioritaire}>
                  <div className="space-y-2">
                    {form.training.objectives.map((obj, index) => (
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
              <RadioGroup value={form.delaiApplication || ""} onValueChange={form.setDelaiApplication}>
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
              <VoiceTextarea
                id="freins"
                value={form.freinsApplication}
                onValueChange={form.setFreinsApplication}
                onChange={(e) => form.setFreinsApplication(e.target.value)}
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
              <RadioGroup value={form.rythme || ""} onValueChange={form.setRythme}>
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
              <RadioGroup value={form.equilibreTheoriePratique || ""} onValueChange={form.setEquilibreTheoriePratique}>
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
              <VoiceTextarea
                id="amelioration"
                value={form.ameliorationSuggeree}
                onValueChange={form.setAmeliorationSuggeree}
                onChange={(e) => form.setAmeliorationSuggeree(e.target.value)}
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
                value={form.conditionsInfoSatisfaisantes === null ? "" : form.conditionsInfoSatisfaisantes ? "oui" : "non"}
                onValueChange={(v) => form.setConditionsInfoSatisfaisantes(v === "oui")}
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
                value={form.formationAdapteePublic === null ? "" : form.formationAdapteePublic ? "oui" : "non"}
                onValueChange={(v) => form.setFormationAdapteePublic(v === "oui")}
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
                value={form.qualificationIntervenantAdequate === null ? "" : form.qualificationIntervenantAdequate ? "oui" : "non"}
                onValueChange={(v) => form.setQualificationIntervenantAdequate(v === "oui")}
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
                value={form.appreciationsPrisesEnCompte || ""}
                onValueChange={form.setAppreciationsPrisesEnCompte}
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
              <VoiceTextarea
                id="message-reco"
                value={form.messageRecommandation}
                onValueChange={form.setMessageRecommandation}
                onChange={(e) => form.setMessageRecommandation(e.target.value)}
                placeholder="Votre témoignage..."
                rows={3}
              />
            </div>

            <div className="space-y-3">
              <Label>
                Je consens à ce que ma recommandation soit publiée en mon nom sur le site SuperTilt.fr
              </Label>
              <RadioGroup
                value={form.consentPublication === null ? "" : form.consentPublication ? "oui" : "non"}
                onValueChange={(v) => form.setConsentPublication(v === "oui")}
              >
                <div className="space-y-2">
                  <div className="flex items-start gap-2">
                    <RadioGroupItem value="oui" id="consent-oui" className="mt-1" />
                    <Label htmlFor="consent-oui" className="font-normal cursor-pointer text-sm">
                      Oui, j'accepte la publication (format : {form.evaluation.first_name} {form.evaluation.last_name?.[0]}. - {form.evaluation.company || "Entreprise"})
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
              <VoiceTextarea
                id="remarques"
                value={form.remarquesLibres}
                onValueChange={form.setRemarquesLibres}
                onChange={(e) => form.setRemarquesLibres(e.target.value)}
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
            onClick={form.submit}
            disabled={form.submitting}
            className="min-w-[200px]"
          >
            {form.submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
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
