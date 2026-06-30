import { useState } from "react";
import { ExternalLink, FileText, Trash2, Upload } from "lucide-react";
import { Spinner } from "@/components/ui/spinner";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { toastError } from "@/lib/toastError";
import { resolveContentType } from "@/lib/file-utils";
import { supabase } from "@/integrations/supabase/client";
import { isSentryActive, sendSentryTestEvent } from "@/lib/sentry";
import PageTemplateManager from "@/components/missions/PageTemplateManager";
import { AutoSaveIndicator } from "@/components/settings/SettingsAutoSaveIndicator";
import SettingsGeneralDelays from "@/components/settings/SettingsGeneralDelays";

interface SettingsGeneralProps {
  settings: Record<string, string>;
  updateSetting: (key: string, value: string) => void;
  autoSaveStatus: "idle" | "saving" | "saved";
}

const SettingsGeneral = ({ settings, updateSetting, autoSaveStatus }: SettingsGeneralProps) => {
  const { toast } = useToast();
  const [uploadingReglement, setUploadingReglement] = useState(false);
  const [uploadingStamp, setUploadingStamp] = useState(false);

  const bccEnabled = settings.bcc_enabled === "true";

  const handleSentryTest = async () => {
    if (!import.meta.env.PROD) {
      toast({ title: "Sentry inactif", description: "Le suivi n'est actif qu'en production. Testez sur le site déployé.", variant: "destructive" });
      return;
    }
    if (!isSentryActive()) {
      toast({ title: "Sentry non initialisé", description: "Enregistrez le DSN puis rechargez la page avant de tester.", variant: "destructive" });
      return;
    }
    const res = await sendSentryTestEvent();
    if (res.ok) {
      toast({ title: "Événement reçu par Sentry ✅", description: `ID : ${res.eventId}` });
      return;
    }
    if (res.reason === "network_blocked") {
      toast({
        title: "Sentry bloqué côté navigateur",
        description: "Un bloqueur de pubs (uBlock, Brave Shields, Ghostery, AdGuard…) bloque sentry.io. Désactivez-le sur ce domaine puis réessayez.",
        variant: "destructive",
      });
      return;
    }
    if (res.reason === "flush_timeout") {
      toast({
        title: "Sentry n'a pas confirmé la réception",
        description: "L'event a été émis mais le transport n'a pas pu vider sa file en 5 s. Cause probable : domaine non autorisé dans Sentry → Settings → Security & Privacy → Allowed Domains (ajoutez super-tools.lovable.app et *.lovable.app).",
        variant: "destructive",
      });
      return;
    }
    toast({ title: "Sentry non initialisé", variant: "destructive" });
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
            <p className="text-sm text-muted-foreground">
              Nom et email utilisés comme expéditeur pour tous les emails envoyés par l'application.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-lg">
              <div className="space-y-2">
                <Label htmlFor="sender-name">Nom de l'expéditeur</Label>
                <Input id="sender-name" value={settings.sender_name} onChange={(e) => updateSetting("sender_name", e.target.value)} placeholder="Romain Couturier" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="sender-email">Email de l'expéditeur</Label>
                <Input id="sender-email" type="email" value={settings.sender_email} onChange={(e) => updateSetting("sender_email", e.target.value.replace(/\s+/g, ""))} placeholder="romain@supertilt.fr" />
              </div>
            </div>
            <div className="space-y-2 max-w-lg">
              <Label htmlFor="evaluation-notification-email">Email de notification des évaluations</Label>
              <Input id="evaluation-notification-email" type="email" value={settings.evaluation_notification_email} onChange={(e) => updateSetting("evaluation_notification_email", e.target.value.replace(/\s+/g, ""))} placeholder="email@exemple.com" />
              <p className="text-xs text-muted-foreground">Reçoit un email à chaque soumission d'évaluation par un participant (avis, consentement publication).</p>
            </div>
          </div>

          <Separator />

          {/* BCC Settings */}
          <div className="space-y-4">
            <h3 className="text-sm font-medium">Copie cachée des emails</h3>
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="bcc-toggle" className="text-base">Activer le BCC</Label>
                <p className="text-sm text-muted-foreground">Ajouter automatiquement un destinataire en copie cachée sur tous les emails envoyés.</p>
              </div>
              <Switch id="bcc-toggle" checked={bccEnabled} onCheckedChange={(v) => updateSetting("bcc_enabled", v ? "true" : "false")} />
            </div>
            {bccEnabled && (
              <div className="space-y-2 pl-0 pt-2">
                <Label htmlFor="bcc-email">Adresse email BCC</Label>
                <Input id="bcc-email" type="email" value={settings.bcc_email} onChange={(e) => updateSetting("bcc_email", e.target.value.replace(/\s+/g, ""))} placeholder="email@exemple.com" className="max-w-md" />
              </div>
            )}
          </div>

          <Separator />

          {/* URL Settings */}
          <UrlSettingField label="Fiche Google My Business" description="URL de votre fiche Google pour les demandes d'avis. Cette URL sera utilisée dans les emails de demande d'avis Google." inputId="google-my-business-url" value={settings.google_my_business_url} onChange={(v) => updateSetting("google_my_business_url", v)} placeholder="https://g.page/r/XXXXXXXXX/review" hint={<>Utilisez la variable <code className="px-1 bg-muted rounded">{`{{google_review_link}}`}</code> dans vos templates d'emails.</>} />
          <Separator />
          <UrlSettingField label="Site SuperTilt" description="URL du site SuperTilt. Ce lien sera accessible depuis les formulaires de création/édition de formation." inputId="supertilt-site-url" value={settings.supertilt_site_url} onChange={(v) => updateSetting("supertilt_site_url", v)} placeholder="https://supertilt.fr" />
          <Separator />

          {/* Public links */}
          <div className="space-y-4">
            <h3 className="text-sm font-medium">Liens publics</h3>
            <p className="text-sm text-muted-foreground">URLs utilisées dans les emails envoyés aux participants (certificats, évaluations, etc.).</p>
            <div className="space-y-3 max-w-lg">
              <div className="space-y-2"><Label htmlFor="website-url">Site web</Label><Input id="website-url" type="url" value={settings.website_url} onChange={(e) => updateSetting("website_url", e.target.value)} placeholder="https://www.supertilt.fr" /></div>
              <div className="space-y-2"><Label htmlFor="youtube-url">Chaîne YouTube</Label><Input id="youtube-url" type="url" value={settings.youtube_url} onChange={(e) => updateSetting("youtube_url", e.target.value)} placeholder="https://www.youtube.com/@supertilt" /></div>
              <div className="space-y-2"><Label htmlFor="blog-url">Blog</Label><Input id="blog-url" type="url" value={settings.blog_url} onChange={(e) => updateSetting("blog_url", e.target.value)} placeholder="https://supertilt.fr/blog/" /></div>
            </div>
          </div>

          <Separator />

          {/* Technical URLs */}
          <div className="space-y-4">
            <h3 className="text-sm font-medium">URLs techniques</h3>
            <p className="text-sm text-muted-foreground">URLs utilisées par le système pour les emails, les cartes et les pièces jointes.</p>
            <div className="space-y-3 max-w-lg">
              <div className="space-y-2"><Label htmlFor="app-url">URL de l'application</Label><Input id="app-url" type="url" value={settings.app_url} onChange={(e) => updateSetting("app_url", e.target.value)} placeholder="https://super-tools.lovable.app" /><p className="text-xs text-muted-foreground">URL de base utilisée dans tous les liens des emails.</p></div>
              <div className="space-y-2"><Label htmlFor="google-maps-api-key">Clé API Google Maps</Label><Input id="google-maps-api-key" value={settings.google_maps_api_key} onChange={(e) => updateSetting("google_maps_api_key", e.target.value)} placeholder="AIzaSy..." /></div>
              <div className="space-y-2"><Label htmlFor="qualiopi-path">Chemin certificat Qualiopi (storage)</Label><Input id="qualiopi-path" value={settings.qualiopi_certificate_path} onChange={(e) => updateSetting("qualiopi_certificate_path", e.target.value)} placeholder="certificat-qualiopi/Certificat QUALIOPI v3.pdf" /></div>
            </div>
          </div>

          <Separator />

          {/* Intelligence artificielle */}
          <div className="space-y-4">
            <h3 className="text-sm font-medium">Intelligence artificielle</h3>
            <p className="text-sm text-muted-foreground">Fournisseur IA utilisé pour les générations et analyses automatiques.</p>
            <div className="space-y-2 max-w-lg">
              <Label htmlFor="ai-provider">Fournisseur IA</Label>
              <select id="ai-provider" value={settings.ai_provider ?? "lovable"} onChange={(e) => updateSetting("ai_provider", e.target.value)} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                <option value="lovable">Lovable AI</option>
                <option value="anthropic">Claude (Anthropic)</option>
                <option value="openai">OpenAI</option>
                <option value="gemini">Gemini (Google)</option>
              </select>
              <p className="text-xs text-muted-foreground">Réglage exposé pour préparer la bascule. Le routage effectif des fonctions IA sera connecté dans un second temps (aucun impact pour l'instant).</p>
            </div>
          </div>

          <Separator />

          <UrlSettingField label="Outil de newsletter" description="URL de votre outil de newsletter (ex: Brevo, Mailchimp). Un bouton « Préparer la newsletter » apparaîtra dans la section newsletter de la gestion de contenu." inputId="newsletter-tool-url" value={settings.newsletter_tool_url} onChange={(v) => updateSetting("newsletter_tool_url", v)} placeholder="https://app.brevo.com" />

          <Separator />

          {/* TVA */}
          <div className="space-y-4">
            <h3 className="text-sm font-medium">Taux de TVA</h3>
            <p className="text-sm text-muted-foreground">Taux de TVA par défaut appliqué dans les conventions de formation.</p>
            <div className="space-y-2"><Label htmlFor="tva-rate">Taux de TVA (%)</Label><Input id="tva-rate" type="number" min="0" step="0.1" value={settings.tva_rate} onChange={(e) => updateSetting("tva_rate", e.target.value)} placeholder="20" className="max-w-[120px]" /></div>
          </div>

          <Separator />

          {/* Convention defaults */}
          <div className="space-y-4">
            <h3 className="text-sm font-medium">Convention de formation — Valeurs par défaut</h3>
            <p className="text-sm text-muted-foreground">Ces valeurs sont utilisées lors de la génération des conventions de formation via PDFMonkey.</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-2xl">
              <div className="space-y-2"><Label htmlFor="convention-default-price">Prix HT par défaut (€)</Label><Input id="convention-default-price" type="number" min="0" value={settings.convention_default_price_ht} onChange={(e) => updateSetting("convention_default_price_ht", e.target.value)} placeholder="1250" /><p className="text-xs text-muted-foreground">Utilisé si aucun prix n'est défini sur la formation ou le participant.</p></div>
              <div className="space-y-2"><Label htmlFor="convention-default-horaires">Horaires par défaut</Label><Input id="convention-default-horaires" value={settings.convention_default_horaires} onChange={(e) => updateSetting("convention_default_horaires", e.target.value)} placeholder="9h00-17h00" /><p className="text-xs text-muted-foreground">Affiché si aucun planning n'est défini.</p></div>
              <div className="space-y-2"><Label htmlFor="convention-moyen-pedagogique">Moyen pédagogique</Label><Input id="convention-moyen-pedagogique" value={settings.convention_moyen_pedagogique} onChange={(e) => updateSetting("convention_moyen_pedagogique", e.target.value)} placeholder="SuperTilt" /></div>
              <div className="space-y-2"><Label htmlFor="convention-frais">Frais par défaut (€)</Label><Input id="convention-frais" type="number" min="0" value={settings.convention_frais_default} onChange={(e) => updateSetting("convention_frais_default", e.target.value)} placeholder="0" /></div>
              <div className="space-y-2"><Label htmlFor="convention-affiche-frais">Afficher les frais</Label><select id="convention-affiche-frais" value={settings.convention_affiche_frais} onChange={(e) => updateSetting("convention_affiche_frais", e.target.value)} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"><option value="Non">Non</option><option value="Oui">Oui</option></select></div>
              <div className="space-y-2"><Label htmlFor="elearning-default-duration">Durée e-learning par défaut (jours)</Label><Input id="elearning-default-duration" type="number" min="1" value={settings.elearning_default_duration} onChange={(e) => updateSetting("elearning_default_duration", e.target.value)} placeholder="7" /></div>
            </div>
            <div className="space-y-3 max-w-2xl">
              <div className="space-y-2"><Label htmlFor="elearning-horaires-text">Texte horaires e-learning</Label><Input id="elearning-horaires-text" value={settings.elearning_horaires_text} onChange={(e) => updateSetting("elearning_horaires_text", e.target.value)} placeholder="Formation accessible en ligne à votre rythme" /></div>
              <div className="space-y-2"><Label htmlFor="elearning-lieu-text">Texte lieu e-learning</Label><Input id="elearning-lieu-text" value={settings.elearning_lieu_text} onChange={(e) => updateSetting("elearning_lieu_text", e.target.value)} placeholder="En ligne (plateforme e-learning)" /></div>
            </div>
            <div className="max-w-2xl space-y-3 p-4 rounded-lg border bg-muted/30">
              <Label className="font-medium">Mode d'accès e-learning</Label>
              <p className="text-xs text-muted-foreground">Choisissez comment le participant reçoit son accès à la formation en ligne.</p>
              <div className="flex flex-col gap-2">
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="radio"
                    name="elearning_access_mode"
                    value="woocommerce"
                    checked={(settings.elearning_access_mode ?? "woocommerce") === "woocommerce"}
                    onChange={() => updateSetting("elearning_access_mode", "woocommerce")}
                    className="mt-1"
                  />
                  <div>
                    <p className="text-sm font-medium">WooCommerce</p>
                    <p className="text-xs text-muted-foreground">Email avec un lien d'achat WooCommerce et un coupon 100% de réduction. Procédure d'achat habituelle.</p>
                  </div>
                </label>
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="radio"
                    name="elearning_access_mode"
                    value="magic_link"
                    checked={(settings.elearning_access_mode ?? "woocommerce") === "magic_link"}
                    onChange={() => updateSetting("elearning_access_mode", "magic_link")}
                    className="mt-1"
                  />
                  <div>
                    <p className="text-sm font-medium">Lien magique SuperTools</p>
                    <p className="text-xs text-muted-foreground">Email avec un lien d'accès direct vers l'espace apprenant SuperTools. Le participant crée son compte (ou se connecte) et accède à sa formation. Les nouvelles formations s'ajoutent automatiquement au tableau de bord.</p>
                  </div>
                </label>
              </div>
            </div>
          </div>

          <Separator />

          {/* Stripe */}
          <div className="space-y-4">
            <h3 className="text-sm font-medium">Facturation Stripe</h3>
            <p className="text-sm text-muted-foreground">Clés Stripe pour le système de facturation et d'abonnements. Obtenez vos clés depuis le{" "}<a href="https://dashboard.stripe.com/apikeys" target="_blank" rel="noopener noreferrer" className="underline text-primary">Dashboard Stripe</a>.</p>
            <div className="space-y-3 max-w-lg">
              <div className="space-y-2"><Label htmlFor="stripe-secret-key">Clé secrète (sk_...)</Label><Input id="stripe-secret-key" type="password" value={settings.stripe_secret_key} onChange={(e) => updateSetting("stripe_secret_key", e.target.value)} placeholder="sk_live_..." /></div>
              <div className="space-y-2"><Label htmlFor="stripe-webhook-secret">Secret webhook (whsec_...)</Label><Input id="stripe-webhook-secret" type="password" value={settings.stripe_webhook_secret} onChange={(e) => updateSetting("stripe_webhook_secret", e.target.value)} placeholder="whsec_..." /></div>
            </div>
          </div>

          <Separator />

          {/* Sentry — error monitoring */}
          <div className="space-y-4">
            <h3 className="text-sm font-medium">Suivi des erreurs (Sentry)</h3>
            <p className="text-sm text-muted-foreground">
              Collez votre DSN Sentry pour activer le suivi des erreurs front. Créez un projet React sur{" "}
              <a href="https://sentry.io" target="_blank" rel="noopener noreferrer" className="underline text-primary">sentry.io</a>{" "}
              pour l'obtenir. Le DSN est public par conception. Le suivi n'est actif qu'en production et prend effet au prochain chargement de l'application. Laissez vide pour désactiver.
            </p>
            <div className="space-y-2 max-w-lg">
              <Label htmlFor="sentry-dsn">Sentry DSN</Label>
              <Input id="sentry-dsn" type="password" value={settings.sentry_dsn} onChange={(e) => updateSetting("sentry_dsn", e.target.value.trim())} placeholder="https://...@o000000.ingest.sentry.io/000000" />
            </div>
            <div className="space-y-2">
              <Button type="button" variant="outline" size="sm" onClick={handleSentryTest}>
                Envoyer un événement de test
              </Button>
              <p className="text-xs text-muted-foreground">
                Vérifie l'ingestion : un événement de test doit apparaître dans le projet Sentry sous quelques secondes. Actif uniquement en production avec un DSN chargé. Bouton temporaire à retirer une fois la vérification faite.
              </p>
            </div>
          </div>

          <Separator />

          {/* Delays section */}
          <SettingsGeneralDelays settings={settings} updateSetting={updateSetting} />

          <Separator />

          {/* Règlement intérieur */}
          <div className="space-y-4">
            <h3 className="text-sm font-medium">Règlement intérieur des formations</h3>
            <p className="text-sm text-muted-foreground">Uploadez le règlement intérieur de vos formations (PDF). Il sera consultable depuis la page de synthèse de chaque formation.</p>
            {settings.reglement_interieur_url ? (
              <div className="flex items-center gap-3 p-3 rounded-lg border bg-muted/30 max-w-lg">
                <FileText className="h-5 w-5 text-primary shrink-0" />
                <span className="text-sm font-medium truncate flex-1">Règlement intérieur</span>
                <Button variant="outline" size="sm" asChild>
                  <a href={settings.reglement_interieur_url} target="_blank" rel="noopener noreferrer"><ExternalLink className="h-3.5 w-3.5 mr-1.5" />Consulter</a>
                </Button>
                <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={() => updateSetting("reglement_interieur_url", "")}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            ) : (
              <div className="space-y-2">
                <Label htmlFor="reglement-upload" className="sr-only">Règlement intérieur (PDF)</Label>
                <div className="flex items-center gap-2 max-w-lg">
                  <Button variant="outline" disabled={uploadingReglement} onClick={() => document.getElementById("reglement-upload")?.click()}>
                    {uploadingReglement ? <Spinner className="mr-2" /> : <Upload className="h-4 w-4 mr-2" />}
                    Choisir un fichier PDF
                  </Button>
                  <input id="reglement-upload" type="file" accept=".pdf" className="hidden" onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    if (resolveContentType(file) !== "application/pdf") { toast({ title: "Format invalide", description: "Seuls les fichiers PDF sont acceptés.", variant: "destructive" }); return; }
                    setUploadingReglement(true);
                    try {
                      const ext = file.name.split(".").pop();
                      const path = `reglement-interieur/reglement-interieur-${Date.now()}.${ext}`;
                      const formData = new FormData();
                      formData.append("file", file, file.name);
                      formData.append("path", path);
                      const { data, error } = await supabase.functions.invoke("upload-training-file", { body: formData });
                      if (error) throw error;
                      const publicUrl = (data as { publicUrl?: string } | null)?.publicUrl;
                      if (!publicUrl) throw new Error("URL introuvable après l'upload");
                      updateSetting("reglement_interieur_url", publicUrl);
                      toast({ title: "Fichier uploadé" });
                    } catch (error: unknown) {
                      console.error("Upload error:", error);
                      toastError(toast, error);
                    } finally {
                      setUploadingReglement(false);
                      e.target.value = "";
                    }
                  }} />
                </div>
              </div>
            )}
          </div>

          <Separator />

          {/* Tampon société */}
          <div className="space-y-4">
            <h3 className="text-sm font-medium">Tampon de la société</h3>
            <p className="text-sm text-muted-foreground">Image (PNG, JPG, WebP) du tampon de la société. Apposé en bas des feuilles d'émargement, à côté de la signature du formateur.</p>
            {settings.company_stamp_url ? (
              <div className="flex items-center gap-3 p-3 rounded-lg border bg-muted/30 max-w-lg">
                <img src={settings.company_stamp_url} alt="Tampon société" className="h-16 w-16 object-contain bg-white rounded" />
                <span className="text-sm font-medium truncate flex-1">Tampon société</span>
                <Button variant="outline" size="sm" asChild>
                  <a href={settings.company_stamp_url} target="_blank" rel="noopener noreferrer"><ExternalLink className="h-3.5 w-3.5 mr-1.5" />Voir</a>
                </Button>
                <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={() => updateSetting("company_stamp_url", "")}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            ) : (
              <div className="space-y-2">
                <Label htmlFor="stamp-upload" className="sr-only">Tampon (image)</Label>
                <div className="flex items-center gap-2 max-w-lg">
                  <Button variant="outline" disabled={uploadingStamp} onClick={() => document.getElementById("stamp-upload")?.click()}>
                    {uploadingStamp ? <Spinner className="mr-2" /> : <Upload className="h-4 w-4 mr-2" />}
                    Choisir une image
                  </Button>
                  <input id="stamp-upload" type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    const ct = resolveContentType(file);
                    if (!["image/png", "image/jpeg", "image/webp"].includes(ct)) {
                      toast({ title: "Format invalide", description: "Seules les images PNG, JPG ou WebP sont acceptées.", variant: "destructive" });
                      return;
                    }
                    setUploadingStamp(true);
                    try {
                      const ext = file.name.split(".").pop();
                      const path = `company-stamp/tampon-${Date.now()}.${ext}`;
                      const formData = new FormData();
                      formData.append("file", file, file.name);
                      formData.append("path", path);
                      const { data, error } = await supabase.functions.invoke("upload-training-file", { body: formData });
                      if (error) throw error;
                      const publicUrl = (data as { publicUrl?: string } | null)?.publicUrl;
                      if (!publicUrl) throw new Error("URL introuvable après l'upload");
                      updateSetting("company_stamp_url", publicUrl);
                      toast({ title: "Tampon uploadé" });
                    } catch (error: unknown) {
                      console.error("Upload error:", error);
                      toastError(toast, error);
                    } finally {
                      setUploadingStamp(false);
                      e.target.value = "";
                    }
                  }} />
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
              <Textarea id="can-delete-evaluations" value={settings.can_delete_evaluations_emails} onChange={(e) => updateSetting("can_delete_evaluations_emails", e.target.value)} placeholder="email1@exemple.com, email2@exemple.com" className="max-w-lg" rows={2} />
              <p className="text-xs text-muted-foreground">Adresses email des utilisateurs autorisés à supprimer des évaluations, séparées par des virgules. L'administrateur a toujours ce droit.</p>
            </div>
          </div>

          <AutoSaveIndicator status={autoSaveStatus} />
        </CardContent>
      </Card>

      <div className="mt-6"><PageTemplateManager /></div>
    </>
  );
};

/** Reusable URL setting field with external link button */
function UrlSettingField({ label, description, inputId, value, onChange, placeholder, hint }: {
  label: string;
  description: string;
  inputId: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  hint?: React.ReactNode;
}) {
  return (
    <div className="space-y-4">
      <h3 className="text-sm font-medium">{label}</h3>
      <p className="text-sm text-muted-foreground">{description}</p>
      <div className="space-y-2">
        <Label htmlFor={inputId}>URL</Label>
        <div className="flex gap-2 max-w-lg">
          <Input id={inputId} type="url" value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} />
          <Button variant="outline" size="icon" onClick={() => value && window.open(value, "_blank")} disabled={!value} title="Ouvrir le lien">
            <ExternalLink className="h-4 w-4" />
          </Button>
        </div>
        {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      </div>
    </div>
  );
}

export default SettingsGeneral;
