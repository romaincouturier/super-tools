import { Copy } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { ApiKeyManager } from "@/components/settings/ApiKeyManager";
import GoogleDriveConnect from "@/components/GoogleDriveConnect";
import GoogleCalendarConnect from "@/components/GoogleCalendarConnect";
import SlackChannelCard from "@/components/settings/SlackChannelCard";
import { AutoSaveIndicator } from "@/components/settings/SettingsAutoSaveIndicator";

interface SettingsIntegrationsProps {
  settings: Record<string, string>;
  updateSetting: (key: string, value: string) => void;
  autoSaveStatus: "idle" | "saving" | "saved";
}

const SettingsIntegrations = ({ settings, updateSetting, autoSaveStatus }: SettingsIntegrationsProps) => {
  const { toast } = useToast();

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
              <p className="text-sm font-medium">Google Drive</p>
              <p className="text-xs text-muted-foreground">Stockage de fichiers et pièces jointes</p>
            </div>
            <GoogleDriveConnect />
          </div>
          <Separator />
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Google Calendar</p>
              <p className="text-xs text-muted-foreground">Agenda utilisé par le coach commercial pour contextualiser les recommandations</p>
            </div>
            <GoogleCalendarConnect />
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
                      navigator.clipboard.writeText(url);
                      toast({ title: "Copié", description: "URL copiée dans le presse-papiers." });
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
