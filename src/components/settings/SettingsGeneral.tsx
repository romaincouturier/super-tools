import { useState } from "react";
import { Loader2, ExternalLink, FileText, Trash2, Upload } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import PageTemplateManager from "@/components/missions/PageTemplateManager";
import { AutoSaveIndicator } from "@/components/settings/SettingsAutoSaveIndicator";

interface SettingsGeneralProps {
  settings: Record<string, string>;
  updateSetting: (key: string, value: string) => void;
  autoSaveStatus: "idle" | "saving" | "saved";
}

const SettingsGeneral = ({ settings, updateSetting, autoSaveStatus }: SettingsGeneralProps) => {
  const { toast } = useToast();
  const [uploadingReglement, setUploadingReglement] = useState(false);

  const bccEnabled = settings.bcc_enabled === "true";
  const workingDays: boolean[] = (() => {
    try {
      const days = JSON.parse(settings.working_days);
      if (Array.isArray(days) && days.length === 7) return days;
    } catch { /* fallback */ }
    return [false, true, true, true, true, true, false];
  })();

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Paramètres généraux</CardTitle>
          <CardDescription>
            Configuration globale de l'application.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-8">
          {/* Sender Identity */}
          <div className="space-y-4">
            <h3 className="text-sm font-medium">Identité de l'expéditeur</h3>
            <p className="text-sm text-muted-foreground">
              Nom et email utilisés comme expéditeur pour tous les emails envoyés par l'application.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-lg">
              <div className="space-y-2">
                <Label htmlFor="sender-name">Nom de l'expéditeur</Label>
                <Input
                  id="sender-name"
                  value={settings.sender_name}
                  onChange={(e) => updateSetting("sender_name", e.target.value)}
                  placeholder="Romain Couturier"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="sender-email">Email de l'expéditeur</Label>
                <Input
                  id="sender-email"
                  type="email"
                  value={settings.sender_email}
                  onChange={(e) => updateSetting("sender_email", e.target.value)}
                  placeholder="romain@supertilt.fr"
                />
              </div>
            </div>
            <div className="space-y-2 max-w-lg">
              <Label htmlFor="evaluation-notification-email">Email de notification des évaluations</Label>
              <Input
                id="evaluation-notification-email"
                type="email"
                value={settings.evaluation_notification_email}
                onChange={(e) => updateSetting("evaluation_notification_email", e.target.value)}
                placeholder="email@exemple.com"
              />
              <p className="text-xs text-muted-foreground">
                Reçoit un email à chaque soumission d'évaluation par un participant (avis, consentement publication).
              </p>
            </div>
          </div>

          <Separator />

          {/* BCC Settings */}
          <div className="space-y-4">
            <h3 className="text-sm font-medium">Copie cachée des emails</h3>
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="bcc-toggle" className="text-base">Activer le BCC</Label>
                <p className="text-sm text-muted-foreground">
                  Ajouter automatiquement un destinataire en copie cachée sur tous les emails envoyés.
                </p>
              </div>
              <Switch
                id="bcc-toggle"
                checked={bccEnabled}
                onCheckedChange={(v) => updateSetting("bcc_enabled", v ? "true" : "false")}
              />
            </div>

            {bccEnabled && (
              <div className="space-y-2 pl-0 pt-2">
                <Label htmlFor="bcc-email">Adresse email BCC</Label>
                <Input
                  id="bcc-email"
                  type="email"
                  value={settings.bcc_email}
                  onChange={(e) => updateSetting("bcc_email", e.target.value)}
                  placeholder="email@exemple.com"
                  className="max-w-md"
                />
              </div>
            )}
          </div>

          <Separator />

          {/* Google My Business URL */}
          <div className="space-y-4">
            <h3 className="text-sm font-medium">Fiche Google My Business</h3>
            <p className="text-sm text-muted-foreground">
              URL de votre fiche Google pour les demandes d'avis. Cette URL sera utilisée dans les emails de demande d'avis Google.
            </p>

            <div className="space-y-2">
              <Label htmlFor="google-my-business-url">URL de la fiche Google</Label>
              <div className="flex gap-2 max-w-lg">
                <Input
                  id="google-my-business-url"
                  type="url"
                  value={settings.google_my_business_url}
                  onChange={(e) => updateSetting("google_my_business_url", e.target.value)}
                  placeholder="https://g.page/r/XXXXXXXXX/review"
                />
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => settings.google_my_business_url && window.open(settings.google_my_business_url, "_blank")}
                  disabled={!settings.google_my_business_url}
                  title="Ouvrir le lien"
                >
                  <ExternalLink className="h-4 w-4" />
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Utilisez la variable <code className="px-1 bg-muted rounded">{`{{google_review_link}}`}</code> dans vos templates d'emails.
              </p>
            </div>
          </div>

          <Separator />

          {/* SuperTilt Site URL */}
          <div className="space-y-4">
            <h3 className="text-sm font-medium">Site SuperTilt</h3>
            <p className="text-sm text-muted-foreground">
              URL du site SuperTilt. Ce lien sera accessible depuis les formulaires de création/édition de formation.
            </p>

            <div className="space-y-2">
              <Label htmlFor="supertilt-site-url">URL du site</Label>
              <div className="flex gap-2 max-w-lg">
                <Input
                  id="supertilt-site-url"
                  type="url"
                  value={settings.supertilt_site_url}
                  onChange={(e) => updateSetting("supertilt_site_url", e.target.value)}
                  placeholder="https://supertilt.fr"
                />
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => settings.supertilt_site_url && window.open(settings.supertilt_site_url, "_blank")}
                  disabled={!settings.supertilt_site_url}
                  title="Ouvrir le site"
                >
                  <ExternalLink className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>

          <Separator />

          {/* Website, YouTube, Blog URLs */}
          <div className="space-y-4">
            <h3 className="text-sm font-medium">Liens publics</h3>
            <p className="text-sm text-muted-foreground">
              URLs utilisées dans les emails envoyés aux participants (certificats, évaluations, etc.).
            </p>
            <div className="space-y-3 max-w-lg">
              <div className="space-y-2">
                <Label htmlFor="website-url">Site web</Label>
                <Input
                  id="website-url"
                  type="url"
                  value={settings.website_url}
                  onChange={(e) => updateSetting("website_url", e.target.value)}
                  placeholder="https://www.supertilt.fr"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="youtube-url">Chaîne YouTube</Label>
                <Input
                  id="youtube-url"
                  type="url"
                  value={settings.youtube_url}
                  onChange={(e) => updateSetting("youtube_url", e.target.value)}
                  placeholder="https://www.youtube.com/@supertilt"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="blog-url">Blog</Label>
                <Input
                  id="blog-url"
                  type="url"
                  value={settings.blog_url}
                  onChange={(e) => updateSetting("blog_url", e.target.value)}
                  placeholder="https://supertilt.fr/blog/"
                />
              </div>
            </div>
          </div>

          <Separator />

          {/* Application & Technical URLs */}
          <div className="space-y-4">
            <h3 className="text-sm font-medium">URLs techniques</h3>
            <p className="text-sm text-muted-foreground">
              URLs utilisées par le système pour les emails, les cartes et les pièces jointes.
            </p>
            <div className="space-y-3 max-w-lg">
              <div className="space-y-2">
                <Label htmlFor="app-url">URL de l'application</Label>
                <Input
                  id="app-url"
                  type="url"
                  value={settings.app_url}
                  onChange={(e) => updateSetting("app_url", e.target.value)}
                  placeholder="https://super-tools.lovable.app"
                />
                <p className="text-xs text-muted-foreground">URL de base utilisée dans tous les liens des emails.</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="google-maps-api-key">Clé API Google Maps</Label>
                <Input
                  id="google-maps-api-key"
                  value={settings.google_maps_api_key}
                  onChange={(e) => updateSetting("google_maps_api_key", e.target.value)}
                  placeholder="AIzaSy..."
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="qualiopi-path">Chemin certificat Qualiopi (storage)</Label>
                <Input
                  id="qualiopi-path"
                  value={settings.qualiopi_certificate_path}
                  onChange={(e) => updateSetting("qualiopi_certificate_path", e.target.value)}
                  placeholder="certificat-qualiopi/Certificat QUALIOPI v3.pdf"
                />
              </div>
            </div>
          </div>

          <Separator />

          {/* Newsletter Tool URL */}
          <div className="space-y-4">
            <h3 className="text-sm font-medium">Outil de newsletter</h3>
            <p className="text-sm text-muted-foreground">
              URL de votre outil de newsletter (ex: Brevo, Mailchimp). Un bouton « Préparer la newsletter » apparaîtra dans la section newsletter de la gestion de contenu.
            </p>

            <div className="space-y-2">
              <Label htmlFor="newsletter-tool-url">URL de l'outil</Label>
              <div className="flex gap-2 max-w-lg">
                <Input
                  id="newsletter-tool-url"
                  type="url"
                  value={settings.newsletter_tool_url}
                  onChange={(e) => updateSetting("newsletter_tool_url", e.target.value)}
                  placeholder="https://app.brevo.com"
                />
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => settings.newsletter_tool_url && window.open(settings.newsletter_tool_url, "_blank")}
                  disabled={!settings.newsletter_tool_url}
                  title="Ouvrir l'outil"
                >
                  <ExternalLink className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>

          <Separator />

          {/* TVA Rate */}
          <div className="space-y-4">
            <h3 className="text-sm font-medium">Taux de TVA</h3>
            <p className="text-sm text-muted-foreground">
              Taux de TVA par défaut appliqué dans les conventions de formation.
            </p>
            <div className="space-y-2">
              <Label htmlFor="tva-rate">Taux de TVA (%)</Label>
              <Input
                id="tva-rate"
                type="number"
                min="0"
                step="0.1"
                value={settings.tva_rate}
                onChange={(e) => updateSetting("tva_rate", e.target.value)}
                placeholder="20"
                className="max-w-[120px]"
              />
            </div>
          </div>

          <Separator />

          {/* Convention de formation defaults */}
          <div className="space-y-4">
            <h3 className="text-sm font-medium">Convention de formation — Valeurs par défaut</h3>
            <p className="text-sm text-muted-foreground">
              Ces valeurs sont utilisées lors de la génération des conventions de formation via PDFMonkey.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-2xl">
              <div className="space-y-2">
                <Label htmlFor="convention-default-price">Prix HT par défaut (€)</Label>
                <Input
                  id="convention-default-price"
                  type="number"
                  min="0"
                  value={settings.convention_default_price_ht}
                  onChange={(e) => updateSetting("convention_default_price_ht", e.target.value)}
                  placeholder="1250"
                />
                <p className="text-xs text-muted-foreground">Utilisé si aucun prix n'est défini sur la formation ou le participant.</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="convention-default-horaires">Horaires par défaut</Label>
                <Input
                  id="convention-default-horaires"
                  value={settings.convention_default_horaires}
                  onChange={(e) => updateSetting("convention_default_horaires", e.target.value)}
                  placeholder="9h00-17h00"
                />
                <p className="text-xs text-muted-foreground">Affiché si aucun planning n'est défini.</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="convention-moyen-pedagogique">Moyen pédagogique</Label>
                <Input
                  id="convention-moyen-pedagogique"
                  value={settings.convention_moyen_pedagogique}
                  onChange={(e) => updateSetting("convention_moyen_pedagogique", e.target.value)}
                  placeholder="SuperTilt"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="convention-frais">Frais par défaut (€)</Label>
                <Input
                  id="convention-frais"
                  type="number"
                  min="0"
                  value={settings.convention_frais_default}
                  onChange={(e) => updateSetting("convention_frais_default", e.target.value)}
                  placeholder="0"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="convention-affiche-frais">Afficher les frais</Label>
                <select
                  id="convention-affiche-frais"
                  value={settings.convention_affiche_frais}
                  onChange={(e) => updateSetting("convention_affiche_frais", e.target.value)}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  <option value="Non">Non</option>
                  <option value="Oui">Oui</option>
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="elearning-default-duration">Durée e-learning par défaut (jours)</Label>
                <Input
                  id="elearning-default-duration"
                  type="number"
                  min="1"
                  value={settings.elearning_default_duration}
                  onChange={(e) => updateSetting("elearning_default_duration", e.target.value)}
                  placeholder="7"
                />
              </div>
            </div>
            <div className="space-y-3 max-w-2xl">
              <div className="space-y-2">
                <Label htmlFor="elearning-horaires-text">Texte horaires e-learning</Label>
                <Input
                  id="elearning-horaires-text"
                  value={settings.elearning_horaires_text}
                  onChange={(e) => updateSetting("elearning_horaires_text", e.target.value)}
                  placeholder="Formation accessible en ligne à votre rythme"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="elearning-lieu-text">Texte lieu e-learning</Label>
                <Input
                  id="elearning-lieu-text"
                  value={settings.elearning_lieu_text}
                  onChange={(e) => updateSetting("elearning_lieu_text", e.target.value)}
                  placeholder="En ligne (plateforme e-learning)"
                />
              </div>
            </div>
          </div>

          <Separator />

          {/* Stripe Billing */}
          <div className="space-y-4">
            <h3 className="text-sm font-medium">Facturation Stripe</h3>
            <p className="text-sm text-muted-foreground">
              Clés Stripe pour le système de facturation et d'abonnements. Obtenez vos clés depuis le{" "}
              <a href="https://dashboard.stripe.com/apikeys" target="_blank" rel="noopener noreferrer" className="underline text-primary">
                Dashboard Stripe
              </a>.
            </p>
            <div className="space-y-3 max-w-lg">
              <div className="space-y-2">
                <Label htmlFor="stripe-secret-key">Clé secrète (sk_...)</Label>
                <Input
                  id="stripe-secret-key"
                  type="password"
                  value={settings.stripe_secret_key}
                  onChange={(e) => updateSetting("stripe_secret_key", e.target.value)}
                  placeholder="sk_live_..."
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="stripe-webhook-secret">Secret webhook (whsec_...)</Label>
                <Input
                  id="stripe-webhook-secret"
                  type="password"
                  value={settings.stripe_webhook_secret}
                  onChange={(e) => updateSetting("stripe_webhook_secret", e.target.value)}
                  placeholder="whsec_..."
                />
              </div>
            </div>
          </div>

          <Separator />
          <div className="space-y-4">
            <h3 className="text-sm font-medium">Jours ouvrables</h3>
            <p className="text-sm text-muted-foreground">
              Les emails automatisés (pré et post-formation) seront envoyés uniquement les jours ouvrables sélectionnés.
            </p>

            <div className="flex flex-wrap gap-4">
              {["Dim", "Lun", "Mar", "Mer", "Jeu", "Ven", "Sam"].map((day, index) => (
                <div key={day} className="flex items-center gap-2">
                  <Checkbox
                    id={`working-day-${index}`}
                    checked={workingDays[index]}
                    onCheckedChange={(checked) => {
                      const newDays = [...workingDays];
                      newDays[index] = checked === true;
                      updateSetting("working_days", JSON.stringify(newDays));
                    }}
                  />
                  <Label
                    htmlFor={`working-day-${index}`}
                    className="text-sm cursor-pointer"
                  >
                    {day}
                  </Label>
                </div>
              ))}
            </div>
          </div>

          <Separator />
          <div className="space-y-4">
            <h3 className="text-sm font-medium">Délais des emails avant formation</h3>
            <p className="text-sm text-muted-foreground">
              Configurez les délais d'envoi des emails automatiques avant la date de formation (J-X).
            </p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="delay-needs-survey">Questionnaire de besoins</Label>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">J -</span>
                  <Input
                    id="delay-needs-survey"
                    type="number"
                    min="1"
                    max="30"
                    value={settings.delay_needs_survey_days}
                    onChange={(e) => updateSetting("delay_needs_survey_days", e.target.value)}
                    className="w-20"
                  />
                  <span className="text-sm text-muted-foreground">jours</span>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="delay-reminder">Rappel logistique</Label>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">J -</span>
                  <Input
                    id="delay-reminder"
                    type="number"
                    min="1"
                    max="30"
                    value={settings.delay_reminder_days}
                    onChange={(e) => updateSetting("delay_reminder_days", e.target.value)}
                    className="w-20"
                  />
                  <span className="text-sm text-muted-foreground">jours</span>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="delay-trainer-summary">Synthèse formateur</Label>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">J -</span>
                  <Input
                    id="delay-trainer-summary"
                    type="number"
                    min="1"
                    max="30"
                    value={settings.delay_trainer_summary_days}
                    onChange={(e) => updateSetting("delay_trainer_summary_days", e.target.value)}
                    className="w-20"
                  />
                  <span className="text-sm text-muted-foreground">jours</span>
                </div>
              </div>
            </div>
          </div>

          <Separator />

          {/* Convention reminder delays */}
          <div className="space-y-4">
            <h3 className="text-sm font-medium">Relances convention de formation</h3>
            <p className="text-sm text-muted-foreground">
              Configurez les délais de relance pour la récupération de la convention de formation signée (en jours ouvrés après l'envoi).
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="delay-convention-reminder-1">1ère relance</Label>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">J +</span>
                  <Input
                    id="delay-convention-reminder-1"
                    type="number"
                    min="1"
                    max="30"
                    value={settings.delay_convention_reminder_1_days}
                    onChange={(e) => updateSetting("delay_convention_reminder_1_days", e.target.value)}
                    className="w-20"
                  />
                  <span className="text-sm text-muted-foreground">jours ouvrés</span>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="delay-convention-reminder-2">2ème relance</Label>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">J +</span>
                  <Input
                    id="delay-convention-reminder-2"
                    type="number"
                    min="1"
                    max="30"
                    value={settings.delay_convention_reminder_2_days}
                    onChange={(e) => updateSetting("delay_convention_reminder_2_days", e.target.value)}
                    className="w-20"
                  />
                  <span className="text-sm text-muted-foreground">jours ouvrés</span>
                </div>
              </div>
            </div>
          </div>

          <Separator />

          {/* Email scheduling delays - After training */}
          <div className="space-y-4">
            <h3 className="text-sm font-medium">Délais des emails après formation</h3>
            <p className="text-sm text-muted-foreground">
              Configurez les délais d'envoi des emails automatiques après la date de fin de formation (J+X).
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="space-y-2">
                <Label htmlFor="delay-google-review">Avis Google</Label>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">J +</span>
                  <Input
                    id="delay-google-review"
                    type="number"
                    min="1"
                    max="60"
                    value={settings.delay_google_review_days}
                    onChange={(e) => updateSetting("delay_google_review_days", e.target.value)}
                    className="w-20"
                  />
                  <span className="text-sm text-muted-foreground">jours</span>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="delay-video-testimonial">Témoignage vidéo</Label>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">J +</span>
                  <Input
                    id="delay-video-testimonial"
                    type="number"
                    min="1"
                    max="60"
                    value={settings.delay_video_testimonial_days}
                    onChange={(e) => updateSetting("delay_video_testimonial_days", e.target.value)}
                    className="w-20"
                  />
                  <span className="text-sm text-muted-foreground">jours</span>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="delay-cold-evaluation">Évaluation à froid commanditaire</Label>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">J +</span>
                  <Input
                    id="delay-cold-evaluation"
                    type="number"
                    min="1"
                    max="90"
                    value={settings.delay_cold_evaluation_days}
                    onChange={(e) => updateSetting("delay_cold_evaluation_days", e.target.value)}
                    className="w-20"
                  />
                  <span className="text-sm text-muted-foreground">jours</span>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="delay-cold-evaluation-funder">Évaluation à froid financeur</Label>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">J +</span>
                  <Input
                    id="delay-cold-evaluation-funder"
                    type="number"
                    min="1"
                    max="120"
                    value={settings.delay_cold_evaluation_funder_days}
                    onChange={(e) => updateSetting("delay_cold_evaluation_funder_days", e.target.value)}
                    className="w-20"
                  />
                  <span className="text-sm text-muted-foreground">jours</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  Uniquement si le financeur est différent du commanditaire
                </p>
              </div>
            </div>
          </div>

          <Separator />

          {/* Mission email delays */}
          <div className="space-y-4">
            <h3 className="text-sm font-medium">Délais des emails après mission</h3>
            <p className="text-sm text-muted-foreground">
              Configurez les délais d'envoi des emails automatiques après la date de fin de mission. Envoyés à tous les contacts de la mission.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="delay-mission-google-review">Avis Google</Label>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">J +</span>
                  <Input
                    id="delay-mission-google-review"
                    type="number"
                    min="1"
                    max="60"
                    value={settings.delay_mission_google_review_days}
                    onChange={(e) => updateSetting("delay_mission_google_review_days", e.target.value)}
                    className="w-20"
                  />
                  <span className="text-sm text-muted-foreground">jours après fin mission</span>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="delay-mission-video-testimonial">Témoignage vidéo</Label>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">J +</span>
                  <Input
                    id="delay-mission-video-testimonial"
                    type="number"
                    min="1"
                    max="60"
                    value={settings.delay_mission_video_testimonial_days}
                    onChange={(e) => updateSetting("delay_mission_video_testimonial_days", e.target.value)}
                    className="w-20"
                  />
                  <span className="text-sm text-muted-foreground">jours après l'avis Google</span>
                </div>
              </div>
            </div>
          </div>

          <Separator />

          {/* Evaluation reminder delays */}
          <div className="space-y-4">
            <h3 className="text-sm font-medium">Relances pour collecte des évaluations</h3>
            <p className="text-sm text-muted-foreground">
              Ces relances sont envoyées uniquement aux participants n'ayant pas encore soumis leur évaluation.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="delay-evaluation-reminder-1">1ère relance</Label>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">J +</span>
                  <Input
                    id="delay-evaluation-reminder-1"
                    type="number"
                    min="1"
                    max="30"
                    value={settings.delay_evaluation_reminder_1_days}
                    onChange={(e) => updateSetting("delay_evaluation_reminder_1_days", e.target.value)}
                    className="w-20"
                  />
                  <span className="text-sm text-muted-foreground">jours ouvrables</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  Relance amicale rappelant l'importance de l'évaluation
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="delay-evaluation-reminder-2">2ème relance</Label>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">J +</span>
                  <Input
                    id="delay-evaluation-reminder-2"
                    type="number"
                    min="1"
                    max="30"
                    value={settings.delay_evaluation_reminder_2_days}
                    onChange={(e) => updateSetting("delay_evaluation_reminder_2_days", e.target.value)}
                    className="w-20"
                  />
                  <span className="text-sm text-muted-foreground">jours ouvrables</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  Dernière relance mentionnant l'importance pour Qualiopi
                </p>
              </div>
            </div>
          </div>

          <Separator />

          {/* Follow-up news delay */}
          <div className="space-y-4">
            <h3 className="text-sm font-medium">Prise de nouvelles informelle</h3>
            <p className="text-sm text-muted-foreground">
              Un message personnalisé généré par l'IA est envoyé à chaque participant pour prendre de ses nouvelles et savoir ce qu'il a mis en pratique.
            </p>
            <div className="space-y-2">
              <Label htmlFor="delay-follow-up-news">Délai après envoi du mail de remerciement</Label>
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">J +</span>
                <Input
                  id="delay-follow-up-news"
                  type="number"
                  min="7"
                  max="90"
                  value={settings.delay_follow_up_news_days}
                  onChange={(e) => updateSetting("delay_follow_up_news_days", e.target.value)}
                  className="w-20"
                />
                <span className="text-sm text-muted-foreground">jours ouvrables</span>
              </div>
              <p className="text-xs text-muted-foreground">
                Message informel et humain, sans formulaire ni questionnaire — juste pour nouer la conversation
              </p>
            </div>
          </div>

          <Separator />

          {/* Règlement intérieur */}
          <div className="space-y-4">
            <h3 className="text-sm font-medium">Règlement intérieur des formations</h3>
            <p className="text-sm text-muted-foreground">
              Uploadez le règlement intérieur de vos formations (PDF). Il sera consultable depuis la page de synthèse de chaque formation.
            </p>

            {settings.reglement_interieur_url ? (
              <div className="flex items-center gap-3 p-3 rounded-lg border bg-muted/30 max-w-lg">
                <FileText className="h-5 w-5 text-primary shrink-0" />
                <span className="text-sm font-medium truncate flex-1">Règlement intérieur</span>
                <Button
                  variant="outline"
                  size="sm"
                  asChild
                >
                  <a href={settings.reglement_interieur_url} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="h-3.5 w-3.5 mr-1.5" />
                    Consulter
                  </a>
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-destructive hover:text-destructive"
                  onClick={() => updateSetting("reglement_interieur_url", "")}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            ) : (
              <div className="space-y-2">
                <Label htmlFor="reglement-upload" className="sr-only">Règlement intérieur (PDF)</Label>
                <div className="flex items-center gap-2 max-w-lg">
                  <Button
                    variant="outline"
                    disabled={uploadingReglement}
                    onClick={() => document.getElementById("reglement-upload")?.click()}
                  >
                    {uploadingReglement ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Upload className="h-4 w-4 mr-2" />
                    )}
                    Choisir un fichier PDF
                  </Button>
                  <input
                    id="reglement-upload"
                    type="file"
                    accept=".pdf"
                    className="hidden"
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      if (file.type !== "application/pdf") {
                        toast({ title: "Format invalide", description: "Seuls les fichiers PDF sont acceptés.", variant: "destructive" });
                        return;
                      }
                      setUploadingReglement(true);
                      try {
                        const ext = file.name.split(".").pop();
                        const filePath = `reglement-interieur/reglement-interieur-${Date.now()}.${ext}`;
                        const { error: uploadError } = await supabase.storage
                          .from("training-documents")
                          .upload(filePath, file, { upsert: true });
                        if (uploadError) throw uploadError;
                        const { data: urlData } = supabase.storage
                          .from("training-documents")
                          .getPublicUrl(filePath);
                        updateSetting("reglement_interieur_url", urlData.publicUrl);
                        toast({ title: "Fichier uploadé" });
                      } catch (error: unknown) {
                        console.error("Upload error:", error);
                        toast({ title: "Erreur d'upload", description: error instanceof Error ? error.message : "Erreur inconnue", variant: "destructive" });
                      } finally {
                        setUploadingReglement(false);
                        e.target.value = "";
                      }
                    }}
                  />
                </div>
              </div>
            )}
          </div>

          <Separator />

          {/* Permissions */}
          <div className="space-y-4">
            <h3 className="text-sm font-medium">Droits et permissions</h3>
            <p className="text-sm text-muted-foreground">
              Configurez les permissions spécifiques pour certaines actions sensibles.
            </p>

            <div className="space-y-2">
              <Label htmlFor="can-delete-evaluations">Suppression des évaluations</Label>
              <Textarea
                id="can-delete-evaluations"
                value={settings.can_delete_evaluations_emails}
                onChange={(e) => updateSetting("can_delete_evaluations_emails", e.target.value)}
                placeholder="email1@exemple.com, email2@exemple.com"
                className="max-w-lg"
                rows={2}
              />
              <p className="text-xs text-muted-foreground">
                Adresses email des utilisateurs autorisés à supprimer des évaluations, séparées par des virgules.
                L'administrateur a toujours ce droit.
              </p>
            </div>
          </div>

          <AutoSaveIndicator status={autoSaveStatus} />
        </CardContent>
      </Card>

      {/* Mission Page Templates */}
      <div className="mt-6">
        <PageTemplateManager />
      </div>
    </>
  );
};

export default SettingsGeneral;
