import { useState } from "react";
import { Loader2, Save, ExternalLink, Upload, FileText, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import PageTemplateManager from "@/components/missions/PageTemplateManager";
import { saveSettings, uploadReglementInterieur, type SettingsMap } from "@/data/settings";
import {
  DEFAULT_DELAYS,
  DEFAULT_URLS,
  DEFAULT_TVA_RATE,
  DEFAULT_WORKING_DAYS,
} from "@/lib/constants";

interface GeneralSettingsProps {
  initialSettings: SettingsMap;
}

const GeneralSettings = ({ initialSettings }: GeneralSettingsProps) => {
  const { toast } = useToast();

  // Identity
  const [senderEmail, setSenderEmail] = useState(initialSettings.sender_email || "");
  const [senderName, setSenderName] = useState(initialSettings.sender_name || "");
  const [evaluationNotificationEmail, setEvaluationNotificationEmail] = useState(initialSettings.evaluation_notification_email || "");

  // BCC
  const [bccEnabled, setBccEnabled] = useState(initialSettings.bcc_enabled === "true");
  const [bccEmail, setBccEmail] = useState(initialSettings.bcc_email || "");

  // URLs
  const [googleMyBusinessUrl, setGoogleMyBusinessUrl] = useState(initialSettings.google_my_business_url || DEFAULT_URLS.GOOGLE_MY_BUSINESS);
  const [supertiltSiteUrl, setSupertiltSiteUrl] = useState(initialSettings.supertilt_site_url || DEFAULT_URLS.SUPERTILT_SITE);
  const [websiteUrl, setWebsiteUrl] = useState(initialSettings.website_url || DEFAULT_URLS.WEBSITE);
  const [youtubeUrl, setYoutubeUrl] = useState(initialSettings.youtube_url || DEFAULT_URLS.YOUTUBE);
  const [blogUrl, setBlogUrl] = useState(initialSettings.blog_url || DEFAULT_URLS.BLOG);
  const [newsletterToolUrl, setNewsletterToolUrl] = useState(initialSettings.newsletter_tool_url || "");

  // Settings
  const [tvaRate, setTvaRate] = useState(initialSettings.tva_rate || DEFAULT_TVA_RATE);
  const [workingDays, setWorkingDays] = useState<boolean[]>(() => {
    try {
      const parsed = JSON.parse(initialSettings.working_days || "null");
      return Array.isArray(parsed) && parsed.length === 7 ? parsed : DEFAULT_WORKING_DAYS;
    } catch {
      return DEFAULT_WORKING_DAYS;
    }
  });

  // Delays - before
  const [delayNeedsSurvey, setDelayNeedsSurvey] = useState(initialSettings.delay_needs_survey_days || DEFAULT_DELAYS.NEEDS_SURVEY);
  const [delayReminder, setDelayReminder] = useState(initialSettings.delay_reminder_days || DEFAULT_DELAYS.REMINDER);
  const [delayTrainerSummary, setDelayTrainerSummary] = useState(initialSettings.delay_trainer_summary_days || DEFAULT_DELAYS.TRAINER_SUMMARY);

  // Delays - after
  const [delayGoogleReview, setDelayGoogleReview] = useState(initialSettings.delay_google_review_days || DEFAULT_DELAYS.GOOGLE_REVIEW);
  const [delayVideoTestimonial, setDelayVideoTestimonial] = useState(initialSettings.delay_video_testimonial_days || DEFAULT_DELAYS.VIDEO_TESTIMONIAL);
  const [delayColdEvaluation, setDelayColdEvaluation] = useState(initialSettings.delay_cold_evaluation_days || DEFAULT_DELAYS.COLD_EVALUATION);
  const [delayColdEvaluationFunder, setDelayColdEvaluationFunder] = useState(initialSettings.delay_cold_evaluation_funder_days || DEFAULT_DELAYS.COLD_EVALUATION_FUNDER);
  const [delayEvaluationReminder1, setDelayEvaluationReminder1] = useState(initialSettings.delay_evaluation_reminder_1_days || DEFAULT_DELAYS.EVALUATION_REMINDER_1);
  const [delayEvaluationReminder2, setDelayEvaluationReminder2] = useState(initialSettings.delay_evaluation_reminder_2_days || DEFAULT_DELAYS.EVALUATION_REMINDER_2);
  const [delayConventionReminder1, setDelayConventionReminder1] = useState(initialSettings.delay_convention_reminder_1_days || DEFAULT_DELAYS.CONVENTION_REMINDER_1);
  const [delayConventionReminder2, setDelayConventionReminder2] = useState(initialSettings.delay_convention_reminder_2_days || DEFAULT_DELAYS.CONVENTION_REMINDER_2);

  // Permissions
  const [canDeleteEvaluationsEmails, setCanDeleteEvaluationsEmails] = useState(initialSettings.can_delete_evaluations_emails || "");

  // Reglement
  const [reglementInterieurUrl, setReglementInterieurUrl] = useState<string | null>(initialSettings.reglement_interieur_url || null);
  const [uploadingReglement, setUploadingReglement] = useState(false);

  const [savingSettings, setSavingSettings] = useState(false);

  const handleSaveSettings = async () => {
    setSavingSettings(true);
    try {
      await saveSettings([
        { setting_key: "sender_email", setting_value: senderEmail, description: "Adresse email de l'expéditeur pour tous les envois" },
        { setting_key: "sender_name", setting_value: senderName, description: "Nom de l'expéditeur pour tous les envois" },
        { setting_key: "evaluation_notification_email", setting_value: evaluationNotificationEmail, description: "Email qui reçoit les notifications de nouvelles évaluations" },
        { setting_key: "bcc_email", setting_value: bccEmail, description: "Adresse email en copie cachée (BCC) pour tous les envois" },
        { setting_key: "bcc_enabled", setting_value: bccEnabled.toString(), description: "Activer ou désactiver l'envoi en copie cachée (BCC)" },
        { setting_key: "google_my_business_url", setting_value: googleMyBusinessUrl, description: "URL de la fiche Google My Business pour les demandes d'avis" },
        { setting_key: "supertilt_site_url", setting_value: supertiltSiteUrl, description: "URL du site SuperTilt pour les liens formations" },
        { setting_key: "newsletter_tool_url", setting_value: newsletterToolUrl, description: "URL de l'outil de newsletter (ex: Brevo, Mailchimp)" },
        { setting_key: "website_url", setting_value: websiteUrl, description: "URL du site web principal" },
        { setting_key: "youtube_url", setting_value: youtubeUrl, description: "URL de la chaîne YouTube" },
        { setting_key: "blog_url", setting_value: blogUrl, description: "URL du blog" },
        { setting_key: "tva_rate", setting_value: tvaRate, description: "Taux de TVA par défaut en pourcentage (ex: 20 pour 20%)" },
        { setting_key: "working_days", setting_value: JSON.stringify(workingDays), description: "Jours ouvrables pour l'envoi des emails (tableau de 7 booléens : dim, lun, mar, mer, jeu, ven, sam)" },
        { setting_key: "delay_needs_survey_days", setting_value: delayNeedsSurvey, description: "Délai avant formation pour envoyer le questionnaire de besoins (en jours)" },
        { setting_key: "delay_reminder_days", setting_value: delayReminder, description: "Délai avant formation pour envoyer le rappel logistique (en jours)" },
        { setting_key: "delay_trainer_summary_days", setting_value: delayTrainerSummary, description: "Délai avant formation pour envoyer la synthèse au formateur (en jours)" },
        { setting_key: "delay_google_review_days", setting_value: delayGoogleReview, description: "Délai après formation pour demander un avis Google (en jours ouvrables)" },
        { setting_key: "delay_video_testimonial_days", setting_value: delayVideoTestimonial, description: "Délai après formation pour demander un témoignage vidéo (en jours ouvrables)" },
        { setting_key: "delay_cold_evaluation_days", setting_value: delayColdEvaluation, description: "Délai après formation pour envoyer l'évaluation à froid (en jours ouvrables)" },
        { setting_key: "delay_cold_evaluation_funder_days", setting_value: delayColdEvaluationFunder, description: "Délai après formation pour rappeler de contacter le financeur (en jours ouvrables)" },
        { setting_key: "delay_evaluation_reminder_1_days", setting_value: delayEvaluationReminder1, description: "Délai pour la 1ère relance d'évaluation (en jours ouvrables après le mail de remerciement)" },
        { setting_key: "delay_evaluation_reminder_2_days", setting_value: delayEvaluationReminder2, description: "Délai pour la 2ème relance d'évaluation (en jours ouvrables après le mail de remerciement)" },
        { setting_key: "delay_convention_reminder_1_days", setting_value: delayConventionReminder1, description: "Délai en jours ouvrés pour la 1ère relance convention de formation" },
        { setting_key: "delay_convention_reminder_2_days", setting_value: delayConventionReminder2, description: "Délai en jours ouvrés pour la 2ème relance convention de formation" },
        { setting_key: "can_delete_evaluations_emails", setting_value: canDeleteEvaluationsEmails, description: "Emails des utilisateurs autorisés à supprimer des évaluations (séparés par des virgules)" },
        { setting_key: "reglement_interieur_url", setting_value: reglementInterieurUrl || "", description: "URL du règlement intérieur des formations (PDF uploadé)" },
      ]);

      toast({ title: "Paramètres enregistrés", description: "Les paramètres généraux ont été mis à jour." });
    } catch (error) {
      console.error("Save settings error:", error);
      toast({ title: "Erreur", description: "Impossible d'enregistrer les paramètres.", variant: "destructive" });
    } finally {
      setSavingSettings(false);
    }
  };

  const handleReglementUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.type !== "application/pdf") {
      toast({ title: "Format invalide", description: "Seuls les fichiers PDF sont acceptés.", variant: "destructive" });
      return;
    }
    setUploadingReglement(true);
    try {
      const url = await uploadReglementInterieur(file);
      setReglementInterieurUrl(url);
      toast({ title: "Fichier uploadé" });
    } catch (err) {
      console.error("Upload error:", err);
      toast({ title: "Erreur d'upload", description: "Impossible d'uploader le fichier.", variant: "destructive" });
    } finally {
      setUploadingReglement(false);
      e.target.value = "";
    }
  };

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Paramètres généraux</CardTitle>
          <CardDescription>Configuration globale de l'application.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-8">
          {/* Sender Identity */}
          <div className="space-y-4">
            <h3 className="text-sm font-medium">Identité de l'expéditeur</h3>
            <p className="text-sm text-muted-foreground">Nom et email utilisés comme expéditeur pour tous les emails envoyés par l'application.</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-lg">
              <div className="space-y-2">
                <Label htmlFor="sender-name">Nom de l'expéditeur</Label>
                <Input id="sender-name" value={senderName} onChange={(e) => setSenderName(e.target.value)} placeholder="Romain Couturier" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="sender-email">Email de l'expéditeur</Label>
                <Input id="sender-email" type="email" value={senderEmail} onChange={(e) => setSenderEmail(e.target.value)} placeholder="romain@supertilt.fr" />
              </div>
            </div>
            <div className="space-y-2 max-w-lg">
              <Label htmlFor="evaluation-notification-email">Email de notification des évaluations</Label>
              <Input id="evaluation-notification-email" type="email" value={evaluationNotificationEmail} onChange={(e) => setEvaluationNotificationEmail(e.target.value)} placeholder="email@exemple.com" />
              <p className="text-xs text-muted-foreground">Reçoit un email à chaque soumission d'évaluation par un participant (avis, consentement publication).</p>
            </div>
          </div>

          <Separator />

          {/* BCC */}
          <div className="space-y-4">
            <h3 className="text-sm font-medium">Copie cachée des emails</h3>
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="bcc-toggle" className="text-base">Activer le BCC</Label>
                <p className="text-sm text-muted-foreground">Ajouter automatiquement un destinataire en copie cachée sur tous les emails envoyés.</p>
              </div>
              <Switch id="bcc-toggle" checked={bccEnabled} onCheckedChange={setBccEnabled} />
            </div>
            {bccEnabled && (
              <div className="space-y-2 pl-0 pt-2">
                <Label htmlFor="bcc-email">Adresse email BCC</Label>
                <Input id="bcc-email" type="email" value={bccEmail} onChange={(e) => setBccEmail(e.target.value)} placeholder="email@exemple.com" className="max-w-md" />
              </div>
            )}
          </div>

          <Separator />

          {/* Google My Business URL */}
          <div className="space-y-4">
            <h3 className="text-sm font-medium">Fiche Google My Business</h3>
            <p className="text-sm text-muted-foreground">URL de votre fiche Google pour les demandes d'avis. Cette URL sera utilisée dans les emails de demande d'avis Google.</p>
            <div className="space-y-2">
              <Label htmlFor="google-my-business-url">URL de la fiche Google</Label>
              <div className="flex gap-2 max-w-lg">
                <Input id="google-my-business-url" type="url" value={googleMyBusinessUrl} onChange={(e) => setGoogleMyBusinessUrl(e.target.value)} placeholder="https://g.page/r/XXXXXXXXX/review" />
                <Button variant="outline" size="icon" onClick={() => googleMyBusinessUrl && window.open(googleMyBusinessUrl, "_blank")} disabled={!googleMyBusinessUrl} title="Ouvrir le lien">
                  <ExternalLink className="h-4 w-4" />
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">Utilisez la variable <code className="px-1 bg-muted rounded">{`{{google_review_link}}`}</code> dans vos templates d'emails.</p>
            </div>
          </div>

          <Separator />

          {/* Site URLs */}
          <div className="space-y-4">
            <h3 className="text-sm font-medium">Site SuperTilt</h3>
            <p className="text-sm text-muted-foreground">URL du site SuperTilt. Ce lien sera accessible depuis les formulaires de création/édition de formation.</p>
            <div className="space-y-2">
              <Label htmlFor="supertilt-site-url">URL du site</Label>
              <div className="flex gap-2 max-w-lg">
                <Input id="supertilt-site-url" type="url" value={supertiltSiteUrl} onChange={(e) => setSupertiltSiteUrl(e.target.value)} placeholder="https://supertilt.fr" />
                <Button variant="outline" size="icon" onClick={() => supertiltSiteUrl && window.open(supertiltSiteUrl, "_blank")} disabled={!supertiltSiteUrl} title="Ouvrir le site">
                  <ExternalLink className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>

          <Separator />

          {/* Public links */}
          <div className="space-y-4">
            <h3 className="text-sm font-medium">Liens publics</h3>
            <p className="text-sm text-muted-foreground">URLs utilisées dans les emails envoyés aux participants (certificats, évaluations, etc.).</p>
            <div className="space-y-3 max-w-lg">
              <div className="space-y-2">
                <Label htmlFor="website-url">Site web</Label>
                <Input id="website-url" type="url" value={websiteUrl} onChange={(e) => setWebsiteUrl(e.target.value)} placeholder="https://www.supertilt.fr" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="youtube-url">Chaîne YouTube</Label>
                <Input id="youtube-url" type="url" value={youtubeUrl} onChange={(e) => setYoutubeUrl(e.target.value)} placeholder="https://www.youtube.com/@supertilt" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="blog-url">Blog</Label>
                <Input id="blog-url" type="url" value={blogUrl} onChange={(e) => setBlogUrl(e.target.value)} placeholder="https://supertilt.fr/blog/" />
              </div>
            </div>
          </div>

          <Separator />

          {/* Newsletter */}
          <div className="space-y-4">
            <h3 className="text-sm font-medium">Outil de newsletter</h3>
            <p className="text-sm text-muted-foreground">URL de votre outil de newsletter (ex: Brevo, Mailchimp). Un bouton « Préparer la newsletter » apparaîtra dans la section newsletter de la gestion de contenu.</p>
            <div className="space-y-2">
              <Label htmlFor="newsletter-tool-url">URL de l'outil</Label>
              <div className="flex gap-2 max-w-lg">
                <Input id="newsletter-tool-url" type="url" value={newsletterToolUrl} onChange={(e) => setNewsletterToolUrl(e.target.value)} placeholder="https://app.brevo.com" />
                <Button variant="outline" size="icon" onClick={() => newsletterToolUrl && window.open(newsletterToolUrl, "_blank")} disabled={!newsletterToolUrl} title="Ouvrir l'outil">
                  <ExternalLink className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>

          <Separator />

          {/* TVA */}
          <div className="space-y-4">
            <h3 className="text-sm font-medium">Taux de TVA</h3>
            <p className="text-sm text-muted-foreground">Taux de TVA par défaut appliqué dans les conventions de formation.</p>
            <div className="space-y-2">
              <Label htmlFor="tva-rate">Taux de TVA (%)</Label>
              <Input id="tva-rate" type="number" min="0" step="0.1" value={tvaRate} onChange={(e) => setTvaRate(e.target.value)} placeholder="20" className="max-w-[120px]" />
            </div>
          </div>

          <Separator />

          {/* Working days */}
          <div className="space-y-4">
            <h3 className="text-sm font-medium">Jours ouvrables</h3>
            <p className="text-sm text-muted-foreground">Les emails automatisés (pré et post-formation) seront envoyés uniquement les jours ouvrables sélectionnés.</p>
            <div className="flex flex-wrap gap-4">
              {["Dim", "Lun", "Mar", "Mer", "Jeu", "Ven", "Sam"].map((day, index) => (
                <div key={day} className="flex items-center gap-2">
                  <Checkbox
                    id={`working-day-${index}`}
                    checked={workingDays[index]}
                    onCheckedChange={(checked) => {
                      const newDays = [...workingDays];
                      newDays[index] = checked === true;
                      setWorkingDays(newDays);
                    }}
                  />
                  <Label htmlFor={`working-day-${index}`} className="text-sm cursor-pointer">{day}</Label>
                </div>
              ))}
            </div>
          </div>

          <Separator />

          {/* Before-training delays */}
          <div className="space-y-4">
            <h3 className="text-sm font-medium">Délais des emails avant formation</h3>
            <p className="text-sm text-muted-foreground">Configurez les délais d'envoi des emails automatiques avant la date de formation (J-X).</p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <DelayInput label="Questionnaire de besoins" id="delay-needs-survey" prefix="J -" value={delayNeedsSurvey} onChange={setDelayNeedsSurvey} max={30} />
              <DelayInput label="Rappel logistique" id="delay-reminder" prefix="J -" value={delayReminder} onChange={setDelayReminder} max={30} />
              <DelayInput label="Synthèse formateur" id="delay-trainer-summary" prefix="J -" value={delayTrainerSummary} onChange={setDelayTrainerSummary} max={30} />
            </div>
          </div>

          <Separator />

          {/* Convention reminder delays */}
          <div className="space-y-4">
            <h3 className="text-sm font-medium">Relances convention de formation</h3>
            <p className="text-sm text-muted-foreground">Configurez les délais de relance pour la récupération de la convention de formation signée (en jours ouvrés après l'envoi).</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <DelayInput label="1ère relance" id="delay-convention-reminder-1" prefix="J +" value={delayConventionReminder1} onChange={setDelayConventionReminder1} max={30} suffix="jours ouvrés" />
              <DelayInput label="2ème relance" id="delay-convention-reminder-2" prefix="J +" value={delayConventionReminder2} onChange={setDelayConventionReminder2} max={30} suffix="jours ouvrés" />
            </div>
          </div>

          <Separator />

          {/* After-training delays */}
          <div className="space-y-4">
            <h3 className="text-sm font-medium">Délais des emails après formation</h3>
            <p className="text-sm text-muted-foreground">Configurez les délais d'envoi des emails automatiques après la date de fin de formation (J+X).</p>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <DelayInput label="Avis Google" id="delay-google-review" prefix="J +" value={delayGoogleReview} onChange={setDelayGoogleReview} max={60} />
              <DelayInput label="Témoignage vidéo" id="delay-video-testimonial" prefix="J +" value={delayVideoTestimonial} onChange={setDelayVideoTestimonial} max={60} />
              <DelayInput label="Évaluation à froid commanditaire" id="delay-cold-evaluation" prefix="J +" value={delayColdEvaluation} onChange={setDelayColdEvaluation} max={90} />
              <div className="space-y-2">
                <Label htmlFor="delay-cold-evaluation-funder">Évaluation à froid financeur</Label>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">J +</span>
                  <Input id="delay-cold-evaluation-funder" type="number" min="1" max={120} value={delayColdEvaluationFunder} onChange={(e) => setDelayColdEvaluationFunder(e.target.value)} className="w-20" />
                  <span className="text-sm text-muted-foreground">jours</span>
                </div>
                <p className="text-xs text-muted-foreground">Uniquement si le financeur est différent du commanditaire</p>
              </div>
            </div>
          </div>

          <Separator />

          {/* Evaluation reminder delays */}
          <div className="space-y-4">
            <h3 className="text-sm font-medium">Relances pour collecte des évaluations</h3>
            <p className="text-sm text-muted-foreground">Ces relances sont envoyées uniquement aux participants n'ayant pas encore soumis leur évaluation.</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="delay-evaluation-reminder-1">1ère relance</Label>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">J +</span>
                  <Input id="delay-evaluation-reminder-1" type="number" min="1" max={30} value={delayEvaluationReminder1} onChange={(e) => setDelayEvaluationReminder1(e.target.value)} className="w-20" />
                  <span className="text-sm text-muted-foreground">jours ouvrables</span>
                </div>
                <p className="text-xs text-muted-foreground">Relance amicale rappelant l'importance de l'évaluation</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="delay-evaluation-reminder-2">2ème relance</Label>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">J +</span>
                  <Input id="delay-evaluation-reminder-2" type="number" min="1" max={30} value={delayEvaluationReminder2} onChange={(e) => setDelayEvaluationReminder2(e.target.value)} className="w-20" />
                  <span className="text-sm text-muted-foreground">jours ouvrables</span>
                </div>
                <p className="text-xs text-muted-foreground">Dernière relance mentionnant l'importance pour Qualiopi</p>
              </div>
            </div>
          </div>

          <Separator />

          {/* Reglement interieur */}
          <div className="space-y-4">
            <h3 className="text-sm font-medium">Règlement intérieur des formations</h3>
            <p className="text-sm text-muted-foreground">Uploadez le règlement intérieur de vos formations (PDF). Il sera consultable depuis la page de synthèse de chaque formation.</p>
            {reglementInterieurUrl ? (
              <div className="flex items-center gap-3 p-3 rounded-lg border bg-muted/30 max-w-lg">
                <FileText className="h-5 w-5 text-primary shrink-0" />
                <span className="text-sm font-medium truncate flex-1">Règlement intérieur</span>
                <Button variant="outline" size="sm" asChild>
                  <a href={reglementInterieurUrl} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="h-3.5 w-3.5 mr-1.5" />
                    Consulter
                  </a>
                </Button>
                <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={() => setReglementInterieurUrl(null)}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            ) : (
              <div className="space-y-2">
                <Label htmlFor="reglement-upload" className="sr-only">Règlement intérieur (PDF)</Label>
                <div className="flex items-center gap-2 max-w-lg">
                  <Button variant="outline" disabled={uploadingReglement} onClick={() => document.getElementById("reglement-upload")?.click()}>
                    {uploadingReglement ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Upload className="h-4 w-4 mr-2" />}
                    Choisir un fichier PDF
                  </Button>
                  <input id="reglement-upload" type="file" accept=".pdf" className="hidden" onChange={handleReglementUpload} />
                </div>
              </div>
            )}
          </div>

          <Separator />

          {/* Permissions */}
          <div className="space-y-4">
            <h3 className="text-sm font-medium">Droits et permissions</h3>
            <p className="text-sm text-muted-foreground">Configurez les permissions spécifiques pour certaines actions sensibles.</p>
            <div className="space-y-2">
              <Label htmlFor="can-delete-evaluations">Suppression des évaluations</Label>
              <Textarea id="can-delete-evaluations" value={canDeleteEvaluationsEmails} onChange={(e) => setCanDeleteEvaluationsEmails(e.target.value)} placeholder="email1@exemple.com, email2@exemple.com" className="max-w-lg" rows={2} />
              <p className="text-xs text-muted-foreground">Adresses email des utilisateurs autorisés à supprimer des évaluations, séparées par des virgules. L'administrateur a toujours ce droit.</p>
            </div>
          </div>

          <Button onClick={handleSaveSettings} disabled={savingSettings}>
            {savingSettings ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
            Enregistrer
          </Button>
        </CardContent>
      </Card>

      <div className="mt-6">
        <PageTemplateManager />
      </div>
    </>
  );
};

/** Reusable delay input field */
function DelayInput({ label, id, prefix, value, onChange, max, suffix = "jours" }: {
  label: string;
  id: string;
  prefix: string;
  value: string;
  onChange: (val: string) => void;
  max: number;
  suffix?: string;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <div className="flex items-center gap-2">
        <span className="text-sm text-muted-foreground">{prefix}</span>
        <Input id={id} type="number" min="1" max={max} value={value} onChange={(e) => onChange(e.target.value)} className="w-20" />
        <span className="text-sm text-muted-foreground">{suffix}</span>
      </div>
    </div>
  );
}

export default GeneralSettings;
