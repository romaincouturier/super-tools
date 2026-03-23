import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { VoiceTextarea } from "@/components/ui/voice-textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ExternalLink } from "lucide-react";
import { Link } from "react-router-dom";
import type { QuestionnaireRecord, TrainingRecord } from "@/hooks/useQuestionnaire";

interface Props {
  questionnaire: QuestionnaireRecord;
  setQuestionnaire: React.Dispatch<React.SetStateAction<QuestionnaireRecord | null>>;
  training: TrainingRecord | null;
  prerequisValidations: Record<string, string>;
  setPrerequisValidations: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  accessibiliteChoice: "" | "oui" | "non";
  setAccessibiliteChoice: (v: "" | "oui" | "non") => void;
  isInterEntreprises: boolean;
  contactEmail: string;
  contactName: string;
  markDirty: () => void;
  hasUnvalidatedPrerequisites: () => boolean;
  submitting: boolean;
  submit: () => Promise<void>;
  saveDraft: (opts?: { silent?: boolean; force?: boolean }) => Promise<void>;
  saving: boolean;
}

const QuestionnaireFormSections = ({
  questionnaire, setQuestionnaire, training,
  prerequisValidations, setPrerequisValidations,
  accessibiliteChoice, setAccessibiliteChoice,
  isInterEntreprises, contactEmail, contactName,
  markDirty, hasUnvalidatedPrerequisites,
  submitting, submit, saveDraft, saving,
}: Props) => {
  const updateField = (field: keyof QuestionnaireRecord, value: QuestionnaireRecord[keyof QuestionnaireRecord]) => {
    markDirty();
    setQuestionnaire((p) => (p ? { ...p, [field]: value } : p));
  };

  return (
    <>
      {/* Identity */}
      <Card>
        <CardHeader><CardTitle className="text-lg">Vos coordonnées</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="prenom">Prénom</Label>
              <Input id="prenom" value={questionnaire.prenom || ""} onChange={(e) => updateField("prenom", e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="nom">Nom</Label>
              <Input id="nom" value={questionnaire.nom || ""} onChange={(e) => updateField("nom", e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="societe">Société</Label>
              <Input id="societe" value={questionnaire.societe || ""} onChange={(e) => updateField("societe", e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="fonction">Fonction</Label>
              <Input id="fonction" value={questionnaire.fonction || ""} onChange={(e) => updateField("fonction", e.target.value)} />
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
        <CardHeader><CardTitle className="text-lg">1. Votre expérience sur le sujet</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-3">
            <Label>Avez-vous déjà une expérience sur ce sujet ?</Label>
            <RadioGroup value={questionnaire.experience_sujet || ""} onValueChange={(v) => updateField("experience_sujet", v)} className="flex flex-col space-y-2">
              {[
                { value: "aucune", label: "Aucune expérience" },
                { value: "courte", label: "Expérience courte (moins de 6 mois)" },
                { value: "longue", label: "Expérience longue (plus de 6 mois)" },
                { value: "certification", label: "Expérience avec certification" },
              ].map(opt => (
                <div key={opt.value} className="flex items-center space-x-2">
                  <RadioGroupItem value={opt.value} id={`exp-${opt.value}`} />
                  <Label htmlFor={`exp-${opt.value}`} className="font-normal cursor-pointer">{opt.label}</Label>
                </div>
              ))}
            </RadioGroup>
          </div>
          {questionnaire.experience_sujet && questionnaire.experience_sujet !== "aucune" && (
            <div className="space-y-2">
              <Label htmlFor="experience_details">Précisez votre expérience</Label>
              <VoiceTextarea id="experience_details" value={questionnaire.experience_details || ""} onValueChange={(v) => updateField("experience_details", v)} onChange={(e) => updateField("experience_details", e.target.value)} rows={3} placeholder="Décrivez votre contexte, vos enjeux..." />
            </div>
          )}
        </CardContent>
      </Card>

      {/* 2. Programme et prérequis */}
      <Card>
        <CardHeader><CardTitle className="text-lg">2. Programme et prérequis</CardTitle></CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-3">
            <Label>Avez-vous consulté le programme de formation ?</Label>
            <div className="flex items-center gap-4">
              <RadioGroup value={questionnaire.lecture_programme || ""} onValueChange={(v) => updateField("lecture_programme", v)} className="flex space-x-4">
                {[{ value: "complete", label: "Oui, en entier" }, { value: "partielle", label: "Partiellement" }, { value: "non", label: "Non" }].map(opt => (
                  <div key={opt.value} className="flex items-center space-x-2">
                    <RadioGroupItem value={opt.value} id={`prog-${opt.value}`} />
                    <Label htmlFor={`prog-${opt.value}`} className="font-normal cursor-pointer">{opt.label}</Label>
                  </div>
                ))}
              </RadioGroup>
              {training?.program_file_url && (
                <Button variant="outline" size="sm" asChild>
                  <a href={training.program_file_url} target="_blank" rel="noopener noreferrer"><ExternalLink className="w-4 h-4 mr-2" />Consulter le programme</a>
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
                    <RadioGroup value={prerequisValidations[prereq] || ""} onValueChange={(v) => { markDirty(); setPrerequisValidations((prev) => ({ ...prev, [prereq]: v })); }} className="flex flex-wrap gap-4">
                      {[{ value: "oui", label: "Oui, je valide" }, { value: "partiellement", label: "Partiellement" }, { value: "non", label: "Non" }].map(opt => (
                        <div key={opt.value} className="flex items-center space-x-2">
                          <RadioGroupItem value={opt.value} id={`prereq-${idx}-${opt.value}`} />
                          <Label htmlFor={`prereq-${idx}-${opt.value}`} className="font-normal cursor-pointer text-sm">{opt.label}</Label>
                        </div>
                      ))}
                    </RadioGroup>
                  </div>
                ))}
              </div>
              {hasUnvalidatedPrerequisites() && (
                <div className="space-y-2">
                  <Label htmlFor="prerequis_details">Lesquels vous manquent-ils ?</Label>
                  <VoiceTextarea id="prerequis_details" value={questionnaire.prerequis_details || ""} onValueChange={(v) => updateField("prerequis_details", v)} onChange={(e) => updateField("prerequis_details", e.target.value)} rows={3} placeholder="Précisez ce qui vous manque..." />
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* 3. Auto-évaluation */}
      <Card>
        <CardHeader><CardTitle className="text-lg">3. Auto-évaluation</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <Label>Évaluez votre niveau actuel sur ce sujet (0 = débutant, 5 = expert)</Label>
          <div className="space-y-4">
            <Slider value={[questionnaire.niveau_actuel ?? 0]} onValueChange={([v]) => updateField("niveau_actuel", v)} max={5} step={1} className="w-full" />
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
        <CardHeader><CardTitle className="text-lg">4. Compétences visées et objectifs</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          <Label htmlFor="competences_visees">Quelles compétences concrètes souhaitez-vous acquérir et comment s'inscrivent-elles dans votre mission ?</Label>
          <VoiceTextarea id="competences_visees" value={questionnaire.competences_visees || ""} onValueChange={(v) => updateField("competences_visees", v)} onChange={(e) => updateField("competences_visees", e.target.value)} rows={4} placeholder="Décrivez les compétences que vous souhaitez développer et leur lien avec votre activité..." />
        </CardContent>
      </Card>

      {/* 5. Motivation */}
      <Card>
        <CardHeader><CardTitle className="text-lg">5. Niveau de motivation</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <Label>Quel est votre niveau de motivation à venir à cette formation ? (1 à 5)</Label>
          <div className="space-y-4">
            <Slider value={[questionnaire.niveau_motivation ?? 3]} onValueChange={([v]) => updateField("niveau_motivation", v)} min={1} max={5} step={1} className="w-full" />
            <div className="flex justify-between text-sm text-muted-foreground">
              <span>1</span>
              <span className="font-medium text-foreground text-lg">{questionnaire.niveau_motivation ?? 3}</span>
              <span>5</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 6. Contraintes (inter only) */}
      {isInterEntreprises && (
        <Card>
          <CardHeader><CardTitle className="text-lg">6. Contraintes d'organisation</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            <Label htmlFor="contraintes">Avez-vous des contraintes horaires ou organisationnelles à signaler ?</Label>
            <VoiceTextarea id="contraintes" value={questionnaire.contraintes_orga || ""} onValueChange={(v) => updateField("contraintes_orga", v)} onChange={(e) => updateField("contraintes_orga", e.target.value)} rows={3} placeholder="Horaires, déplacements, matériel..." />
          </CardContent>
        </Card>
      )}

      {/* Accessibilité */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">{isInterEntreprises ? "7" : "6"}. Accessibilité et aménagements</CardTitle>
          <CardDescription>Optionnel</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-3">
            <Label>Avez-vous besoin d'aménagements spécifiques (liés à une situation de handicap moteur, visuel ou auditif, trouble dys, autisme, difficulté d'attention, autre) ?</Label>
            <RadioGroup value={accessibiliteChoice} onValueChange={(v: string) => { markDirty(); const choice = v as "oui" | "non"; setAccessibiliteChoice(choice); if (choice === "non") setQuestionnaire((p) => (p ? { ...p, besoins_accessibilite: "" } : p)); }}>
              <div className="flex items-center space-x-2"><RadioGroupItem value="non" id="access-non" /><Label htmlFor="access-non" className="cursor-pointer">Non</Label></div>
              <div className="flex items-center space-x-2"><RadioGroupItem value="oui" id="access-oui" /><Label htmlFor="access-oui" className="cursor-pointer">Oui</Label></div>
            </RadioGroup>
            {accessibiliteChoice === "oui" && (
              <div className="space-y-2 pl-6 border-l-2 border-primary/30">
                <Label htmlFor="accessibilite">Décrivez vos besoins :</Label>
                <VoiceTextarea id="accessibilite" value={questionnaire.besoins_accessibilite || ""} onValueChange={(v) => updateField("besoins_accessibilite", v)} onChange={(e) => updateField("besoins_accessibilite", e.target.value)} rows={3} placeholder="Décrivez vos besoins..." />
              </div>
            )}
          </div>
          <p className="text-sm text-muted-foreground border-l-2 border-primary pl-3">
            Notre référent handicap : <strong>{contactName}</strong> – <a href={`mailto:${contactEmail}`} className="text-primary hover:underline">{contactEmail}</a>
          </p>
        </CardContent>
      </Card>

      {/* Commentaires libres */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">{isInterEntreprises ? "8" : "7"}. Commentaires libres</CardTitle>
          <CardDescription>Optionnel</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          <Label htmlFor="commentaires">Autres éléments à partager pour optimiser votre expérience ?</Label>
          <VoiceTextarea id="commentaires" value={questionnaire.commentaires_libres || ""} onValueChange={(v) => updateField("commentaires_libres", v)} onChange={(e) => updateField("commentaires_libres", e.target.value)} rows={3} />
        </CardContent>
      </Card>

      {/* RGPD */}
      <Card>
        <CardHeader><CardTitle className="text-lg">{isInterEntreprises ? "9" : "8"}. Consentement RGPD</CardTitle></CardHeader>
        <CardContent>
          <div className="flex items-start gap-3 rounded-md border p-4 bg-muted/30">
            <Checkbox id="rgpd" checked={questionnaire.consentement_rgpd} onCheckedChange={(checked) => { markDirty(); setQuestionnaire((p) => (p ? { ...p, consentement_rgpd: checked === true, date_consentement_rgpd: checked ? new Date().toISOString() : null } : p)); }} />
            <Label htmlFor="rgpd" className="font-normal cursor-pointer leading-relaxed text-sm">
              J'accepte que mes données personnelles soient traitées dans le cadre de cette formation conformément au RGPD. Ces données seront utilisées uniquement pour personnaliser la formation et ne seront pas communiquées à des tiers.{" "}
              <Link to="/politique-confidentialite" target="_blank" className="text-primary hover:underline">En savoir plus</Link>
            </Label>
          </div>
        </CardContent>
      </Card>

      {/* Submit */}
      <div className="flex flex-col sm:flex-row gap-3 pb-8">
        <Button className="flex-1" onClick={submit} disabled={submitting || !questionnaire.consentement_rgpd}>
          {submitting ? "Envoi en cours..." : "Envoyer mes réponses"}
        </Button>
        <Button variant="outline" onClick={() => saveDraft()} disabled={saving}>
          {saving ? "Sauvegarde..." : "Sauvegarder le brouillon"}
        </Button>
      </div>
    </>
  );
};

export default QuestionnaireFormSections;
