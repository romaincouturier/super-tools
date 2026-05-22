import { Copy, ExternalLink } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useCopyToClipboard } from "@/hooks/useCopyToClipboard";
import { ApiKeyManager } from "@/components/settings/ApiKeyManager";
import GoogleConnect from "@/components/GoogleConnect";
import SlackChannelCard from "@/components/settings/SlackChannelCard";
import { AutoSaveIndicator } from "@/components/settings/SettingsAutoSaveIndicator";

interface SettingsIntegrationsProps {
  settings: Record<string, string>;
  updateSetting: (key: string, value: string) => void;
  autoSaveStatus: "idle" | "saving" | "saved";
}

const SettingsIntegrations = ({ settings, updateSetting, autoSaveStatus }: SettingsIntegrationsProps) => {
  const { copy } = useCopyToClipboard();

  return (
    <div className="space-y-6">
      <ApiKeyManager />
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Connexions Google</CardTitle>
          <CardDescription>Connectez vos services Google pour enrichir les fonctionnalités.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Google (Drive + Calendar)</p>
              <p className="text-xs text-muted-foreground">Stockage de fichiers, agenda et réunions</p>
            </div>
            <GoogleConnect />
          </div>
        </CardContent>
      </Card>

      <SlackChannelCard
        currentChannel={settings.slack_crm_channel}
        onChannelChange={(val) => updateSetting("slack_crm_channel", val)}
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Email entrant → CRM</CardTitle>
          <CardDescription>Créez automatiquement une opportunité CRM à chaque email reçu sur une adresse dédiée.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-2">
            <Label htmlFor="crm-inbound-email">Adresse email dédiée CRM</Label>
            <Input
              id="crm-inbound-email"
              type="email"
              value={settings.crm_inbound_email}
              onChange={(e) => updateSetting("crm_inbound_email", e.target.value)}
              placeholder="crm@votredomaine.fr"
            />
            <p className="text-xs text-muted-foreground">
              Configurez cette adresse dans Resend (Inbound Emails) avec le webhook pointant vers votre edge function <code>resend-inbound-webhook</code>.
              Chaque email reçu à cette adresse sera analysé par l'IA et créera automatiquement une opportunité dans la première colonne du CRM.
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Fireflies</CardTitle>
          <CardDescription>Intégration webhook Fireflies pour recevoir automatiquement les transcripts de réunions.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>URL du webhook</Label>
            <div className="flex items-center gap-2">
              <code className="flex-1 text-xs bg-muted px-3 py-2 rounded border break-all select-all">
                {`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/fireflies-webhook`}
              </code>
              <Button
                variant="outline"
                size="icon"
                className="shrink-0"
                onClick={() => copy(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/fireflies-webhook`, { title: "Copié", description: "URL copiée dans le presse-papiers." })}
              >
                <Copy className="h-4 w-4" />
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Dans Fireflies : Paramètres → Webhooks → ajoutez cette URL et copiez le <em>Signing Secret</em> généré dans le champ ci-dessous.
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="fireflies-webhook-secret">Signing Secret Fireflies</Label>
            <Input
              id="fireflies-webhook-secret"
              type="password"
              value={settings.fireflies_webhook_secret || ""}
              onChange={(e) => updateSetting("fireflies_webhook_secret", e.target.value)}
              placeholder="Secret généré par Fireflies"
            />
            <p className="text-xs text-muted-foreground">
              Laissez vide pour désactiver la vérification du secret (non recommandé).
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Google Drive — Dossiers de polling</CardTitle>
          <CardDescription>IDs des dossiers Google Drive surveillés automatiquement pour les transcripts vidéo et les témoignages.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="drive-folder-transcripts">ID du dossier Transcripts</Label>
            <div className="flex gap-2">
              <Input
                id="drive-folder-transcripts"
                value={settings.google_drive_folder_transcripts || ""}
                onChange={(e) => updateSetting("google_drive_folder_transcripts", e.target.value)}
                placeholder="Ex: 1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs"
              />
              <Button
                type="button"
                variant="outline"
                size="icon"
                asChild
                disabled={!settings.google_drive_folder_transcripts}
                title="Ouvrir dans Google Drive"
              >
                <a
                  href={settings.google_drive_folder_transcripts ? `https://drive.google.com/drive/folders/${settings.google_drive_folder_transcripts}` : undefined}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-disabled={!settings.google_drive_folder_transcripts}
                >
                  <ExternalLink className="h-4 w-4" />
                </a>
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Ouvrez le dossier dans Google Drive → copiez l'ID depuis l'URL <code>drive.google.com/drive/folders/<strong>ID</strong></code>.
            </p>
          </div>
          <Separator />
          <div className="space-y-2">
            <Label htmlFor="drive-folder-testimonials">ID du dossier Témoignages</Label>
            <div className="flex gap-2">
              <Input
                id="drive-folder-testimonials"
                value={settings.google_drive_folder_testimonials || ""}
                onChange={(e) => updateSetting("google_drive_folder_testimonials", e.target.value)}
                placeholder="Ex: 1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs"
              />
              <Button
                type="button"
                variant="outline"
                size="icon"
                asChild
                disabled={!settings.google_drive_folder_testimonials}
                title="Ouvrir dans Google Drive"
              >
                <a
                  href={settings.google_drive_folder_testimonials ? `https://drive.google.com/drive/folders/${settings.google_drive_folder_testimonials}` : undefined}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-disabled={!settings.google_drive_folder_testimonials}
                >
                  <ExternalLink className="h-4 w-4" />
                </a>
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Dossier contenant les vidéos de témoignages clients. Chaque nouveau fichier <code>.mp4</code> / <code>.mov</code> sera transcrit et indexé automatiquement.
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">WooCommerce</CardTitle>
          <CardDescription>Identifiants API WooCommerce pour la génération automatique de coupons e-learning.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="wc-store-url">URL de la boutique</Label>
            <Input
              id="wc-store-url"
              type="url"
              value={settings.woocommerce_store_url}
              onChange={(e) => updateSetting("woocommerce_store_url", e.target.value)}
              placeholder="https://www.supertilt.fr"
            />
          </div>
          <Separator />
          <div className="space-y-2">
            <Label htmlFor="wc-consumer-key">Consumer Key</Label>
            <Input
              id="wc-consumer-key"
              type="password"
              value={settings.woocommerce_consumer_key}
              onChange={(e) => updateSetting("woocommerce_consumer_key", e.target.value)}
              placeholder="ck_..."
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="wc-consumer-secret">Consumer Secret</Label>
            <Input
              id="wc-consumer-secret"
              type="password"
              value={settings.woocommerce_consumer_secret}
              onChange={(e) => updateSetting("woocommerce_consumer_secret", e.target.value)}
              placeholder="cs_..."
            />
          </div>
          <p className="text-xs text-muted-foreground">
            Créez une clé API dans WordPress → WooCommerce → Réglages → Avancé → API REST. Choisissez les permissions <strong>Lecture/Écriture</strong>.
          </p>
          <Separator />
          <div className="space-y-2">
            <Label htmlFor="wc-cart-base-url">URL de base du panier</Label>
            <Input
              id="wc-cart-base-url"
              type="url"
              value={settings.woocommerce_cart_base_url}
              onChange={(e) => updateSetting("woocommerce_cart_base_url", e.target.value)}
              placeholder="https://supertilt.fr/commande/?add-to-cart="
            />
            <p className="text-xs text-muted-foreground">
              URL utilisée pour construire le lien d'accès e-learning. Le <code>woocommerce_product_id</code> du catalogue sera ajouté automatiquement à la fin.
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Intégration LearnDash</CardTitle>
          <CardDescription>
            URLs à intégrer dans vos cours LearnDash pour le recueil des besoins et l'évaluation finale.
            Remplacez les variables entre accolades par les variables LearnDash correspondantes.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {[
            { label: "Recueil des besoins", sublabel: "À placer dans la première leçon", path: "formulaire/besoins" },
            { label: "Évaluation finale", sublabel: "À placer dans la dernière leçon", path: "formulaire/evaluation" },
          ].map(({ label, sublabel, path }) => {
            const url = `${window.location.origin}/${path}?email={user_email}&product_id={product_id}`;
            return (
              <div key={path} className="space-y-1.5">
                <Label>{label}</Label>
                <p className="text-xs text-muted-foreground">{sublabel}</p>
                <div className="flex items-center gap-2">
                  <code className="flex-1 text-xs bg-muted px-3 py-2 rounded border break-all select-all">
                    {url}
                  </code>
                  <Button
                    variant="outline"
                    size="icon"
                    className="shrink-0"
                    onClick={() => {
                      copy(url, { title: "Copié", description: "URL copiée dans le presse-papiers." });
                    }}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            );
          })}
          <p className="text-xs text-muted-foreground pt-2">
            <strong>Variables LearnDash</strong> : <code>{"{user_email}"}</code> = email de l'utilisateur connecté, <code>{"{product_id}"}</code> = ID du produit WooCommerce du cours.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">WP-Statistics</CardTitle>
          <CardDescription>Token API pour récupérer les statistiques du site WordPress (supertilt.fr).</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          <Label htmlFor="wp-stats-token">Token API WP-Statistics</Label>
          <Input
            id="wp-stats-token"
            type="password"
            value={settings.wp_statistics_api_token}
            onChange={(e) => updateSetting("wp_statistics_api_token", e.target.value)}
            placeholder="Votre token WP-Statistics"
          />
          <p className="text-xs text-muted-foreground">
            Dans WordPress : WP Statistics → Réglages → onglet API → activez le REST API → copiez le token généré.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Pennylane</CardTitle>
          <CardDescription>Token API Pennylane v2 pour alimenter le module Finances (factures clients/fournisseurs, trésorerie).</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          <Label htmlFor="pennylane-token">Token API Pennylane</Label>
          <Input
            id="pennylane-token"
            type="password"
            value={settings.pennylane_api_token || ""}
            onChange={(e) => updateSetting("pennylane_api_token", e.target.value)}
            placeholder="Bearer token Pennylane"
          />
          <p className="text-xs text-muted-foreground">
            Dans Pennylane : Paramètres entreprise → Connectivité → API → générer un Company API Token avec les scopes <code>customer_invoices:all</code>, <code>supplier_invoices:readonly</code>, <code>customers:all</code>, <code>products:readonly</code>, <code>bank_accounts:readonly</code>, <code>transactions:readonly</code>.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">OpenAI</CardTitle>
          <CardDescription>Clé API OpenAI utilisée pour l'OCR (images veille), les embeddings RAG et les analyses automatiques.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="openai-api-key">Clé API OpenAI</Label>
            <Input
              id="openai-api-key"
              type="password"
              value={settings.openai_api_key}
              onChange={(e) => updateSetting("openai_api_key", e.target.value)}
              placeholder="sk-..."
            />
            <p className="text-xs text-muted-foreground">
              Obtenez une clé sur <code>platform.openai.com/api-keys</code>. Utilisée pour l'OCR des images (veille), les embeddings de recherche sémantique et les analyses IA.
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Recherche SIREN</CardTitle>
          <CardDescription>Clés API pour la recherche d'entreprises par SIREN (micro-devis).</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="insee-api-key">Clé API INSEE SIRENE</Label>
            <Input
              id="insee-api-key"
              type="password"
              value={settings.insee_api_key}
              onChange={(e) => updateSetting("insee_api_key", e.target.value)}
              placeholder="Votre clé API INSEE"
            />
            <p className="text-xs text-muted-foreground">
              Obtenez une clé sur <code>api.insee.fr</code> (API SIRENE). Utilisée pour rechercher une entreprise par SIREN ou par nom.
            </p>
          </div>
          <Separator />
          <div className="space-y-2">
            <Label htmlFor="google-search-api-key">Clé API Google Custom Search</Label>
            <Input
              id="google-search-api-key"
              type="password"
              value={settings.google_search_api_key}
              onChange={(e) => updateSetting("google_search_api_key", e.target.value)}
              placeholder="Votre clé API Google"
            />
            <p className="text-xs text-muted-foreground">
              Utilisée en fallback si l'API INSEE ne trouve pas de résultat lors de la recherche de SIREN par nom.
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="google-search-engine-id">ID du moteur Google (cx)</Label>
            <Input
              id="google-search-engine-id"
              value={settings.google_search_engine_id}
              onChange={(e) => updateSetting("google_search_engine_id", e.target.value)}
              placeholder="Ex: 017576662512468239146:omuauf_gy24"
            />
            <p className="text-xs text-muted-foreground">
              Créez un moteur de recherche personnalisé sur <code>programmablesearchengine.google.com</code> et copiez l'identifiant (cx).
            </p>
          </div>
        </CardContent>
      </Card>
      <AutoSaveIndicator status={autoSaveStatus} />
    </div>
  );
};

export default SettingsIntegrations;
