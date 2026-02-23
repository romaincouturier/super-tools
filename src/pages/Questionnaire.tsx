import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Slider } from "@/components/ui/slider";
import {
  Loader2,
  ExternalLink,
  Calendar,
  Clock,
  CheckCircle2,
  MapPin,
  Video,
  WifiOff,
  RefreshCw,
  AlertTriangle,
} from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import supertiltLogo from "@/assets/supertilt-logo-anthracite-transparent.png";
import { useQuestionnaire } from "./useQuestionnaire";

const Questionnaire = () => {
  const q = useQuestionnaire();

  if (q.loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (q.error || !q.questionnaire) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-6">
        <Card className="w-full max-w-lg">
          <CardHeader>
            <AlertTriangle className="w-12 h-12 text-destructive mx-auto mb-2" />
            <CardTitle className="text-center">Questionnaire</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-center">
            <p className="text-muted-foreground">{q.error || "Questionnaire introuvable."}</p>
            <div className="flex flex-col gap-2">
              <Button
                onClick={() => {
                  q.setRetryCount((c) => c + 1);
                  q.setError(null);
                  q.setLoading(true);
                  q.fetchData();
                }}
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                Réessayer
              </Button>
              <Button asChild variant="outline">
                <a href="/">Retour à l'accueil</a>
              </Button>
            </div>
            {q.retryCount > 0 && (
              <p className="text-xs text-muted-foreground mt-2">
                Si le problème persiste, vérifiez votre connexion internet ou contactez-nous à{" "}
                <a href={`mailto:${q.contactEmail}`} className="text-primary hover:underline">
                  {q.contactEmail}
                </a>
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  // Already submitted - show confirmation with option to edit
  if (q.questionnaire.etat === "complete" && !q.editingAfterSubmit) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-6">
        <Card className="w-full max-w-lg">
          <CardHeader className="text-center">
            <CheckCircle2 className="w-16 h-16 text-primary mx-auto mb-4" />
            <CardTitle>Questionnaire envoyé !</CardTitle>
            <CardDescription>
              Merci d'avoir complété le questionnaire de recueil des besoins pour la formation "
              {q.training?.training_name}".
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-center">
            <p className="text-muted-foreground">
              Vos réponses ont bien été enregistrées et seront utilisées pour adapter la formation à
              vos attentes.
            </p>
            {q.questionnaire.date_soumission && (
              <p className="text-xs text-muted-foreground">
                Soumis le{" "}
                {format(new Date(q.questionnaire.date_soumission), "d MMMM yyyy 'à' HH:mm", {
                  locale: fr,
                })}
              </p>
            )}
            <div className="space-y-2 pt-2">
              <p className="text-sm font-medium">Vous pouvez modifier vos réponses :</p>
              <Button className="w-full" onClick={() => q.setEditingAfterSubmit(true)}>
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
      {!q.isOnline && (
        <div className="fixed top-0 left-0 right-0 z-50 bg-destructive text-destructive-foreground px-4 py-2 text-center text-sm flex items-center justify-center gap-2">
          <WifiOff className="w-4 h-4" />
          Vous êtes hors connexion. Vos réponses seront sauvegardées dès le retour du réseau.
        </div>
      )}

      {/* Floating save status indicator */}
      {q.saveStatus !== "idle" && (
        <div
          className={`fixed bottom-4 right-4 z-50 px-3 py-2 rounded-lg shadow-lg text-sm flex items-center gap-2 transition-all ${
            q.saveStatus === "saving"
              ? "bg-muted text-muted-foreground"
              : q.saveStatus === "saved"
                ? "bg-primary/10 text-primary"
                : "bg-destructive/10 text-destructive"
          }`}
        >
          {q.saveStatus === "saving" && (
            <>
              <Loader2 className="w-3 h-3 animate-spin" /> Sauvegarde...
            </>
          )}
          {q.saveStatus === "saved" && (
            <>
              <CheckCircle2 className="w-3 h-3" /> Sauvegardé
            </>
          )}
          {q.saveStatus === "error" && (
            <>
              <AlertTriangle className="w-3 h-3" />
              Erreur de sauvegarde
              <button
                onClick={() => q.saveDraft({ silent: false })}
                className="underline ml-1 font-medium"
              >
                Réessayer
              </button>
            </>
          )}
        </div>
      )}
      <div className="mx-auto w-full max-w-3xl space-y-6" onBlur={q.handleFieldBlur}>
        {/* Logo */}
        <div className="flex justify-center">
          <a href="https://www.supertilt.fr" target="_blank" rel="noopener noreferrer">
            <img src={supertiltLogo} alt="SuperTilt" className="h-12 md:h-16" />
          </a>
        </div>

        {/* Header with training info */}
        <Card>
          <CardHeader>
            <CardTitle className="text-xl md:text-2xl">
              Questionnaire de recueil des besoins
            </CardTitle>
            {q.training && (
              <CardDescription className="space-y-3 pt-2">
                <p className="text-base font-medium text-foreground">{q.training.training_name}</p>
                {q.schedules.length > 0 && (
                  <div className="space-y-2">
                    <div className="grid grid-cols-[1fr_auto] gap-x-6 gap-y-1">
                      {q.schedules.map((sched, idx) => (
                        <div key={idx} className="contents">
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <Calendar className="w-4 h-4 shrink-0" />
                            <span className="capitalize">
                              {q.formatScheduleDate(sched.day_date)}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <Clock className="w-4 h-4 shrink-0" />
                            <span>
                              {q.formatTime(sched.start_time)} - {q.formatTime(sched.end_time)}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                    <p className="text-xs text-muted-foreground italic">
                      Horaires indiqués en heure de Paris
                    </p>
                  </div>
                )}
                {q.training.location && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    {(() => {
                      const loc = q.training!.location!.toLowerCase();
                      const isOnline =
                        loc.includes("visio") ||
                        loc.includes("en ligne") ||
                        loc.includes("distanciel") ||
                        loc.includes("zoom") ||
                        loc.includes("teams") ||
                        loc.includes("meet");
                      const urlMatch = q.training!.location!.match(/(https?:\/\/[^\s]+)/);
                      return (
                        <>
                          {isOnline ? (
                            <Video className="w-4 h-4 shrink-0" />
                          ) : (
                            <MapPin className="w-4 h-4 shrink-0" />
                          )}
                          {urlMatch ? (
                            <a
                              href={urlMatch[0]}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-primary hover:underline"
                            >
                              {q.training!.location}
                            </a>
                          ) : (
                            <span>{q.training!.location}</span>
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
                  value={q.questionnaire.prenom || ""}
                  onChange={(e) => {
                    q.markDirty();
                    q.setQuestionnaire((p) => (p ? { ...p, prenom: e.target.value } : p));
                  }}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="nom">Nom</Label>
                <Input
                  id="nom"
                  value={q.questionnaire.nom || ""}
                  onChange={(e) => {
                    q.markDirty();
                    q.setQuestionnaire((p) => (p ? { ...p, nom: e.target.value } : p));
                  }}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="societe">Société</Label>
                <Input
                  id="societe"
                  value={q.questionnaire.societe || ""}
                  onChange={(e) => {
                    q.markDirty();
                    q.setQuestionnaire((p) => (p ? { ...p, societe: e.target.value } : p));
                  }}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="fonction">Fonction</Label>
                <Input
                  id="fonction"
                  value={q.questionnaire.fonction || ""}
                  onChange={(e) => {
                    q.markDirty();
                    q.setQuestionnaire((p) => (p ? { ...p, fonction: e.target.value } : p));
                  }}
                />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  value={q.questionnaire.email || ""}
                  readOnly
                  className="bg-muted"
                />
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
                value={q.questionnaire.experience_sujet || ""}
                onValueChange={(value) => {
                  q.markDirty();
                  q.setQuestionnaire((p) => (p ? { ...p, experience_sujet: value } : p));
                }}
                className="flex flex-col space-y-2"
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="aucune" id="exp-aucune" />
                  <Label htmlFor="exp-aucune" className="font-normal cursor-pointer">
                    Aucune expérience
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="courte" id="exp-courte" />
                  <Label htmlFor="exp-courte" className="font-normal cursor-pointer">
                    Expérience courte (moins de 6 mois)
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="longue" id="exp-longue" />
                  <Label htmlFor="exp-longue" className="font-normal cursor-pointer">
                    Expérience longue (plus de 6 mois)
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="certification" id="exp-certification" />
                  <Label htmlFor="exp-certification" className="font-normal cursor-pointer">
                    Expérience avec certification
                  </Label>
                </div>
              </RadioGroup>
            </div>
            {q.questionnaire.experience_sujet && q.questionnaire.experience_sujet !== "aucune" && (
              <div className="space-y-2">
                <Label htmlFor="experience_details">Précisez votre expérience</Label>
                <Textarea
                  id="experience_details"
                  value={q.questionnaire.experience_details || ""}
                  onChange={(e) => {
                    q.markDirty();
                    q.setQuestionnaire((p) =>
                      p ? { ...p, experience_details: e.target.value } : p,
                    );
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
                  value={q.questionnaire.lecture_programme || ""}
                  onValueChange={(value) => {
                    q.markDirty();
                    q.setQuestionnaire((p) => (p ? { ...p, lecture_programme: value } : p));
                  }}
                  className="flex space-x-4"
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="complete" id="prog-complete" />
                    <Label htmlFor="prog-complete" className="font-normal cursor-pointer">
                      Oui, en entier
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="partielle" id="prog-partielle" />
                    <Label htmlFor="prog-partielle" className="font-normal cursor-pointer">
                      Partiellement
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="non" id="prog-non" />
                    <Label htmlFor="prog-non" className="font-normal cursor-pointer">
                      Non
                    </Label>
                  </div>
                </RadioGroup>
                {q.training?.program_file_url && (
                  <Button variant="outline" size="sm" asChild>
                    <a href={q.training.program_file_url} target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="w-4 h-4 mr-2" />
                      Consulter le programme
                    </a>
                  </Button>
                )}
              </div>
            </div>

            {q.training?.prerequisites && q.training.prerequisites.length > 0 && (
              <div className="space-y-4">
                <Label className="text-base font-medium">
                  Validez-vous les prérequis suivants ?
                </Label>
                <div className="space-y-4 border rounded-lg p-4 bg-muted/50">
                  {q.training.prerequisites.map((prereq, idx) => (
                    <div key={idx} className="space-y-2">
                      <p className="text-sm font-medium">{prereq}</p>
                      <RadioGroup
                        value={q.prerequisValidations[prereq] || ""}
                        onValueChange={(value) => {
                          q.markDirty();
                          q.setPrerequisValidations((prev) => ({ ...prev, [prereq]: value }));
                        }}
                        className="flex flex-wrap gap-4"
                      >
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="oui" id={`prereq-${idx}-oui`} />
                          <Label
                            htmlFor={`prereq-${idx}-oui`}
                            className="font-normal cursor-pointer text-sm"
                          >
                            Oui, je valide
                          </Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="partiellement" id={`prereq-${idx}-part`} />
                          <Label
                            htmlFor={`prereq-${idx}-part`}
                            className="font-normal cursor-pointer text-sm"
                          >
                            Partiellement
                          </Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="non" id={`prereq-${idx}-non`} />
                          <Label
                            htmlFor={`prereq-${idx}-non`}
                            className="font-normal cursor-pointer text-sm"
                          >
                            Non
                          </Label>
                        </div>
                      </RadioGroup>
                    </div>
                  ))}
                </div>

                {q.hasUnvalidatedPrerequisites() && (
                  <div className="space-y-2">
                    <Label htmlFor="prerequis_details">Lesquels vous manquent-ils ?</Label>
                    <Textarea
                      id="prerequis_details"
                      value={q.questionnaire.prerequis_details || ""}
                      onChange={(e) => {
                        q.markDirty();
                        q.setQuestionnaire((p) =>
                          p ? { ...p, prerequis_details: e.target.value } : p,
                        );
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
                value={[q.questionnaire.niveau_actuel ?? 0]}
                onValueChange={([value]) => {
                  q.markDirty();
                  q.setQuestionnaire((p) => (p ? { ...p, niveau_actuel: value } : p));
                }}
                max={5}
                step={1}
                className="w-full"
              />
              <div className="flex justify-between text-sm text-muted-foreground">
                <span>0 - Débutant</span>
                <span className="font-medium text-foreground text-lg">
                  {q.questionnaire.niveau_actuel ?? 0}
                </span>
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
              Quelles compétences concrètes souhaitez-vous acquérir et comment s'inscrivent-elles
              dans votre mission ?
            </Label>
            <Textarea
              id="competences_visees"
              value={q.questionnaire.competences_visees || ""}
              onChange={(e) => {
                q.markDirty();
                q.setQuestionnaire((p) => (p ? { ...p, competences_visees: e.target.value } : p));
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
                value={[q.questionnaire.niveau_motivation ?? 3]}
                onValueChange={([value]) => {
                  q.markDirty();
                  q.setQuestionnaire((p) => (p ? { ...p, niveau_motivation: value } : p));
                }}
                min={1}
                max={5}
                step={1}
                className="w-full"
              />
              <div className="flex justify-between text-sm text-muted-foreground">
                <span>1</span>
                <span className="font-medium text-foreground text-lg">
                  {q.questionnaire.niveau_motivation ?? 3}
                </span>
                <span>5</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 6. Contraintes d'organisation (inter only) */}
        {q.isInterEntreprises && (
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
                value={q.questionnaire.contraintes_orga || ""}
                onChange={(e) => {
                  q.markDirty();
                  q.setQuestionnaire((p) => (p ? { ...p, contraintes_orga: e.target.value } : p));
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
            <CardTitle className="text-lg">
              {q.isInterEntreprises ? "7" : "6"}. Accessibilité et aménagements
            </CardTitle>
            <CardDescription>Optionnel</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              <Label>
                Avez-vous besoin d'aménagements spécifiques (liés à une situation de handicap
                moteur, visuel ou auditif, trouble dys, autisme, difficulté d'attention, autre) ?
              </Label>
              <RadioGroup
                value={q.accessibiliteChoice}
                onValueChange={(value: string) => {
                  q.markDirty();
                  const choice = value as "oui" | "non";
                  q.setAccessibiliteChoice(choice);
                  if (choice === "non") {
                    q.setQuestionnaire((p) => (p ? { ...p, besoins_accessibilite: "" } : p));
                  }
                }}
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="non" id="access-non" />
                  <Label htmlFor="access-non" className="cursor-pointer">
                    Non
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="oui" id="access-oui" />
                  <Label htmlFor="access-oui" className="cursor-pointer">
                    Oui
                  </Label>
                </div>
              </RadioGroup>
              {q.accessibiliteChoice === "oui" && (
                <div className="space-y-2 pl-6 border-l-2 border-primary/30">
                  <Label htmlFor="accessibilite">Décrivez vos besoins :</Label>
                  <Textarea
                    id="accessibilite"
                    value={q.questionnaire.besoins_accessibilite || ""}
                    onChange={(e) => {
                      q.markDirty();
                      q.setQuestionnaire((p) =>
                        p ? { ...p, besoins_accessibilite: e.target.value } : p,
                      );
                    }}
                    rows={3}
                    placeholder="Décrivez vos besoins..."
                  />
                </div>
              )}
            </div>
            <p className="text-sm text-muted-foreground border-l-2 border-primary pl-3">
              Notre référent handicap : <strong>{q.contactName}</strong> -{" "}
              <a href={`mailto:${q.contactEmail}`} className="text-primary hover:underline">
                {q.contactEmail}
              </a>
            </p>
          </CardContent>
        </Card>

        {/* 8. Commentaires libres */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">
              {q.isInterEntreprises ? "8" : "7"}. Commentaires libres
            </CardTitle>
            <CardDescription>Optionnel</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <Label htmlFor="commentaires">
              Autres éléments à partager pour optimiser votre expérience ?
            </Label>
            <Textarea
              id="commentaires"
              value={q.questionnaire.commentaires_libres || ""}
              onChange={(e) => {
                q.markDirty();
                q.setQuestionnaire((p) => (p ? { ...p, commentaires_libres: e.target.value } : p));
              }}
              rows={3}
            />
          </CardContent>
        </Card>

        {/* 9. RGPD */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">
              {q.isInterEntreprises ? "9" : "8"}. Consentement RGPD
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-start gap-3 rounded-md border p-4 bg-muted/30">
              <Checkbox
                id="rgpd"
                checked={q.questionnaire.consentement_rgpd}
                onCheckedChange={(checked) => {
                  q.markDirty();
                  q.setQuestionnaire((p) =>
                    p ? { ...p, consentement_rgpd: Boolean(checked) } : p,
                  );
                }}
              />
              <div className="space-y-2">
                <Label htmlFor="rgpd" className="cursor-pointer">
                  J'autorise SuperTilt à utiliser mes réponses pour adapter cette formation.
                </Label>
                <p className="text-sm text-muted-foreground">
                  Mes données sont conservées 3 ans (exigence Qualiopi) et ne sont jamais
                  communiquées à des tiers.
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
            onClick={() => q.saveDraft()}
            disabled={q.saving || q.submitting}
          >
            {q.saving ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Sauvegarde...
              </>
            ) : (
              "Sauvegarder"
            )}
          </Button>
          <Button type="button" onClick={q.submit} disabled={q.saving || q.submitting}>
            {q.submitting ? (
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
