import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import AdminLayout from "@/components/admin/AdminLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import {
  Loader2,
  FileText,
  Cloud,
  Mail,
  Sparkles,
  Save,
  Eye,
  EyeOff,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  Key,
  Plus,
  Copy,
  Trash2,
  Zap,
} from "lucide-react";

interface IntegrationsData {
  id: string;
  organization_id: string;
  pdf_provider: string;
  pdfmonkey_api_key: string | null;
  pdfmonkey_template_id: string | null;
  google_drive_enabled: boolean;
  google_drive_client_id: string | null;
  google_drive_client_secret: string | null;
  google_drive_refresh_token: string | null;
  google_drive_folder_id: string | null;
  resend_api_key: string | null;
  resend_from_email: string | null;
  resend_from_name: string | null;
  signitic_enabled: boolean;
  signitic_api_key: string | null;
  signitic_user_email: string | null;
  gemini_enabled: boolean;
  gemini_api_key: string | null;
}

interface ApiKey {
  id: string;
  name: string;
  key_prefix: string;
  is_active: boolean;
  last_used_at: string | null;
  created_at: string;
}

// Generate a secure random API key
function generateApiKey(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let key = "sk_live_";
  for (let i = 0; i < 40; i++) {
    key += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return key;
}

// Hash API key for storage
async function hashKey(key: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(key);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
}

const IntegrationsManagement = () => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [integrations, setIntegrations] = useState<IntegrationsData | null>(null);
  const [organizationId, setOrganizationId] = useState<string | null>(null);
  const [showSecrets, setShowSecrets] = useState<Record<string, boolean>>({});
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [showCreateKeyDialog, setShowCreateKeyDialog] = useState(false);
  const [showNewKeyDialog, setShowNewKeyDialog] = useState(false);
  const [newKeyName, setNewKeyName] = useState("");
  const [newKeyValue, setNewKeyValue] = useState("");
  const [creatingKey, setCreatingKey] = useState(false);
  const [deletingKeyId, setDeletingKeyId] = useState<string | null>(null);
  const { toast } = useToast();

  const [formData, setFormData] = useState({
    // PDF
    pdf_provider: "internal",
    pdfmonkey_api_key: "",
    pdfmonkey_template_id: "",
    // Google Drive
    google_drive_enabled: false,
    google_drive_client_id: "",
    google_drive_client_secret: "",
    google_drive_refresh_token: "",
    google_drive_folder_id: "",
    // Resend
    resend_api_key: "",
    resend_from_email: "",
    resend_from_name: "",
    // Signitic
    signitic_enabled: false,
    signitic_api_key: "",
    signitic_user_email: "",
    // Gemini
    gemini_enabled: false,
    gemini_api_key: "",
  });

  const fetchApiKeys = async (orgId: string) => {
    const { data, error } = await supabase
      .from("api_keys")
      .select("id, name, key_prefix, is_active, last_used_at, created_at")
      .eq("organization_id", orgId)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching API keys:", error);
      return;
    }

    setApiKeys(data || []);
  };

  useEffect(() => {
    const fetchIntegrations = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const { data: profile } = await supabase
          .from("user_profiles")
          .select("organization_id")
          .eq("id", user.id)
          .single();

        if (!profile?.organization_id) {
          setLoading(false);
          return;
        }

        setOrganizationId(profile.organization_id);

        // Fetch integrations
        const { data, error } = await supabase
          .from("integrations")
          .select("*")
          .eq("organization_id", profile.organization_id)
          .single();

        if (error && error.code !== "PGRST116") {
          throw error;
        }

        if (data) {
          setIntegrations(data);
          setFormData({
            pdf_provider: data.pdf_provider || "internal",
            pdfmonkey_api_key: data.pdfmonkey_api_key || "",
            pdfmonkey_template_id: data.pdfmonkey_template_id || "",
            google_drive_enabled: data.google_drive_enabled || false,
            google_drive_client_id: data.google_drive_client_id || "",
            google_drive_client_secret: data.google_drive_client_secret || "",
            google_drive_refresh_token: data.google_drive_refresh_token || "",
            google_drive_folder_id: data.google_drive_folder_id || "",
            resend_api_key: data.resend_api_key || "",
            resend_from_email: data.resend_from_email || "",
            resend_from_name: data.resend_from_name || "",
            signitic_enabled: data.signitic_enabled || false,
            signitic_api_key: data.signitic_api_key || "",
            signitic_user_email: data.signitic_user_email || "",
            gemini_enabled: data.gemini_enabled || false,
            gemini_api_key: data.gemini_api_key || "",
          });
        }

        // Fetch API keys
        await fetchApiKeys(profile.organization_id);
      } catch (error) {
        console.error("Error fetching integrations:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchIntegrations();
  }, []);

  const handleSave = async () => {
    if (!organizationId) return;

    setSaving(true);
    try {
      const updateData = {
        organization_id: organizationId,
        pdf_provider: formData.pdf_provider,
        pdfmonkey_api_key: formData.pdfmonkey_api_key || null,
        pdfmonkey_template_id: formData.pdfmonkey_template_id || null,
        google_drive_enabled: formData.google_drive_enabled,
        google_drive_client_id: formData.google_drive_client_id || null,
        google_drive_client_secret: formData.google_drive_client_secret || null,
        google_drive_refresh_token: formData.google_drive_refresh_token || null,
        google_drive_folder_id: formData.google_drive_folder_id || null,
        resend_api_key: formData.resend_api_key || null,
        resend_from_email: formData.resend_from_email || null,
        resend_from_name: formData.resend_from_name || null,
        signitic_enabled: formData.signitic_enabled,
        signitic_api_key: formData.signitic_api_key || null,
        signitic_user_email: formData.signitic_user_email || null,
        gemini_enabled: formData.gemini_enabled,
        gemini_api_key: formData.gemini_api_key || null,
        updated_at: new Date().toISOString(),
      };

      if (integrations) {
        const { error } = await supabase
          .from("integrations")
          .update(updateData)
          .eq("id", integrations.id);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("integrations")
          .insert(updateData);

        if (error) throw error;
      }

      toast({
        title: "Intégrations sauvegardées",
        description: "Les paramètres ont été mis à jour.",
      });
    } catch (error) {
      console.error("Error saving integrations:", error);
      toast({
        title: "Erreur",
        description: "Impossible de sauvegarder les intégrations.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const toggleSecret = (key: string) => {
    setShowSecrets((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleCreateApiKey = async () => {
    if (!newKeyName.trim() || !organizationId) return;

    setCreatingKey(true);
    try {
      const keyValue = generateApiKey();
      const keyHash = await hashKey(keyValue);
      const keyPrefix = keyValue.substring(0, 12) + "...";

      const { data: { user } } = await supabase.auth.getUser();

      const { error } = await supabase.from("api_keys").insert({
        organization_id: organizationId,
        name: newKeyName.trim(),
        key_hash: keyHash,
        key_prefix: keyPrefix,
        created_by: user?.id,
      });

      if (error) {
        if (error.code === "23505") {
          throw new Error("Une clé avec ce nom existe déjà");
        }
        throw error;
      }

      // Show the new key to the user (only time it's visible)
      setNewKeyValue(keyValue);
      setShowCreateKeyDialog(false);
      setShowNewKeyDialog(true);

      // Refresh API keys list
      await fetchApiKeys(organizationId);

      toast({
        title: "Clé API créée",
        description: "Copiez-la maintenant, elle ne sera plus visible ensuite.",
      });
    } catch (error: any) {
      console.error("Error creating API key:", error);
      toast({
        title: "Erreur",
        description: error.message || "Impossible de créer la clé API.",
        variant: "destructive",
      });
    } finally {
      setCreatingKey(false);
      setNewKeyName("");
    }
  };

  const handleDeleteApiKey = async (keyId: string) => {
    if (!organizationId) return;

    setDeletingKeyId(keyId);
    try {
      const { error } = await supabase
        .from("api_keys")
        .delete()
        .eq("id", keyId);

      if (error) throw error;

      await fetchApiKeys(organizationId);

      toast({
        title: "Clé supprimée",
        description: "La clé API a été révoquée.",
      });
    } catch (error) {
      console.error("Error deleting API key:", error);
      toast({
        title: "Erreur",
        description: "Impossible de supprimer la clé API.",
        variant: "destructive",
      });
    } finally {
      setDeletingKeyId(null);
    }
  };

  const handleToggleApiKey = async (keyId: string, isActive: boolean) => {
    if (!organizationId) return;

    try {
      const { error } = await supabase
        .from("api_keys")
        .update({ is_active: isActive })
        .eq("id", keyId);

      if (error) throw error;

      await fetchApiKeys(organizationId);

      toast({
        title: isActive ? "Clé activée" : "Clé désactivée",
        description: isActive
          ? "La clé API est maintenant active."
          : "La clé API a été désactivée.",
      });
    } catch (error) {
      console.error("Error toggling API key:", error);
      toast({
        title: "Erreur",
        description: "Impossible de modifier l'état de la clé.",
        variant: "destructive",
      });
    }
  };

  const copyToClipboard = async (text: string) => {
    await navigator.clipboard.writeText(text);
    toast({
      title: "Copié !",
      description: "La clé API a été copiée dans le presse-papiers.",
    });
  };

  const SecretInput = ({
    id,
    value,
    onChange,
    placeholder,
  }: {
    id: string;
    value: string;
    onChange: (value: string) => void;
    placeholder: string;
  }) => (
    <div className="relative">
      <Input
        id={id}
        type={showSecrets[id] ? "text" : "password"}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="pr-10"
      />
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="absolute right-0 top-0 h-full px-3"
        onClick={() => toggleSecret(id)}
      >
        {showSecrets[id] ? (
          <EyeOff className="h-4 w-4" />
        ) : (
          <Eye className="h-4 w-4" />
        )}
      </Button>
    </div>
  );

  const IntegrationStatus = ({ configured }: { configured: boolean }) => (
    <Badge variant={configured ? "default" : "secondary"} className="ml-2">
      {configured ? (
        <>
          <CheckCircle2 className="h-3 w-3 mr-1" />
          Configuré
        </>
      ) : (
        <>
          <AlertCircle className="h-3 w-3 mr-1" />
          Non configuré
        </>
      )}
    </Badge>
  );

  if (loading) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h2 className="text-xl sm:text-2xl font-bold">Intégrations</h2>
            <p className="text-sm text-muted-foreground">
              Configurez les services externes utilisés par l'application
            </p>
          </div>
          <Button onClick={handleSave} disabled={saving} className="hidden sm:flex">
            {saving ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Save className="h-4 w-4 mr-2" />
            )}
            Enregistrer
          </Button>
        </div>

        <Tabs defaultValue="pdf" className="space-y-4">
          <TabsList className="w-full flex overflow-x-auto sm:grid sm:grid-cols-5 gap-1">
            <TabsTrigger value="pdf" className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0">
              <FileText className="h-4 w-4" />
              <span className="hidden xs:inline">PDF</span>
            </TabsTrigger>
            <TabsTrigger value="storage" className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0">
              <Cloud className="h-4 w-4" />
              <span className="hidden xs:inline">Stockage</span>
            </TabsTrigger>
            <TabsTrigger value="email" className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0">
              <Mail className="h-4 w-4" />
              <span className="hidden xs:inline">Emails</span>
            </TabsTrigger>
            <TabsTrigger value="ai" className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0">
              <Sparkles className="h-4 w-4" />
              <span className="hidden xs:inline">IA</span>
            </TabsTrigger>
            <TabsTrigger value="api" className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0">
              <Zap className="h-4 w-4" />
              <span className="hidden xs:inline">API</span>
            </TabsTrigger>
          </TabsList>

          {/* PDF Generation */}
          <TabsContent value="pdf">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  Génération de PDF
                  <IntegrationStatus
                    configured={
                      formData.pdf_provider === "internal" ||
                      !!formData.pdfmonkey_api_key
                    }
                  />
                </CardTitle>
                <CardDescription>
                  Choisissez comment générer les certificats et documents PDF
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-2">
                  <Label>Méthode de génération</Label>
                  <Select
                    value={formData.pdf_provider}
                    onValueChange={(value) =>
                      setFormData({ ...formData, pdf_provider: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="internal">
                        Interne (jsPDF) - Gratuit, pas de dépendance externe
                      </SelectItem>
                      <SelectItem value="pdfmonkey">
                        PDFMonkey - Templates professionnels
                      </SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    La génération interne utilise jsPDF et ne nécessite aucune configuration.
                  </p>
                </div>

                {formData.pdf_provider === "pdfmonkey" && (
                  <div className="space-y-4 p-4 border rounded-lg bg-muted/50">
                    <div className="flex items-center justify-between">
                      <h4 className="font-medium">Configuration PDFMonkey</h4>
                      <a
                        href="https://www.pdfmonkey.io"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-primary flex items-center gap-1"
                      >
                        Documentation
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="pdfmonkey_api_key">Clé API</Label>
                      <SecretInput
                        id="pdfmonkey_api_key"
                        value={formData.pdfmonkey_api_key}
                        onChange={(value) =>
                          setFormData({ ...formData, pdfmonkey_api_key: value })
                        }
                        placeholder="pk_live_..."
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="pdfmonkey_template_id">ID du template certificat</Label>
                      <Input
                        id="pdfmonkey_template_id"
                        value={formData.pdfmonkey_template_id}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            pdfmonkey_template_id: e.target.value,
                          })
                        }
                        placeholder="6593BDA5-6890-45E8-804F-77488D64BEDF"
                      />
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Storage (Google Drive) */}
          <TabsContent value="storage">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  Google Drive
                  <IntegrationStatus configured={formData.google_drive_enabled && !!formData.google_drive_folder_id} />
                </CardTitle>
                <CardDescription>
                  Archivage automatique des certificats sur Google Drive
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-center justify-between rounded-lg border p-4">
                  <div className="space-y-0.5">
                    <Label>Activer Google Drive</Label>
                    <p className="text-sm text-muted-foreground">
                      Les certificats seront automatiquement sauvegardés sur Drive
                    </p>
                  </div>
                  <Switch
                    checked={formData.google_drive_enabled}
                    onCheckedChange={(checked) =>
                      setFormData({ ...formData, google_drive_enabled: checked })
                    }
                  />
                </div>

                {formData.google_drive_enabled && (
                  <div className="space-y-4 p-4 border rounded-lg bg-muted/50">
                    <div className="flex items-center justify-between">
                      <h4 className="font-medium">Configuration OAuth 2.0</h4>
                      <a
                        href="https://console.cloud.google.com/apis/credentials"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-primary flex items-center gap-1"
                      >
                        Google Cloud Console
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="google_drive_client_id">Client ID</Label>
                      <Input
                        id="google_drive_client_id"
                        value={formData.google_drive_client_id}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            google_drive_client_id: e.target.value,
                          })
                        }
                        placeholder="123456789-abc.apps.googleusercontent.com"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="google_drive_client_secret">Client Secret</Label>
                      <SecretInput
                        id="google_drive_client_secret"
                        value={formData.google_drive_client_secret}
                        onChange={(value) =>
                          setFormData({
                            ...formData,
                            google_drive_client_secret: value,
                          })
                        }
                        placeholder="GOCSPX-..."
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="google_drive_refresh_token">Refresh Token</Label>
                      <SecretInput
                        id="google_drive_refresh_token"
                        value={formData.google_drive_refresh_token}
                        onChange={(value) =>
                          setFormData({
                            ...formData,
                            google_drive_refresh_token: value,
                          })
                        }
                        placeholder="1//0..."
                      />
                      <p className="text-xs text-muted-foreground">
                        Obtenez ce token via le flux OAuth 2.0
                      </p>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="google_drive_folder_id">ID du dossier</Label>
                      <Input
                        id="google_drive_folder_id"
                        value={formData.google_drive_folder_id}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            google_drive_folder_id: e.target.value,
                          })
                        }
                        placeholder="1ABC..."
                      />
                      <p className="text-xs text-muted-foreground">
                        L'ID se trouve dans l'URL du dossier Drive
                      </p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Email */}
          <TabsContent value="email">
            <div className="space-y-4">
              {/* Resend */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    Resend (envoi d'emails)
                    <IntegrationStatus configured={!!formData.resend_api_key} />
                  </CardTitle>
                  <CardDescription>
                    Service d'envoi d'emails transactionnels
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="resend_api_key">Clé API Resend</Label>
                    <SecretInput
                      id="resend_api_key"
                      value={formData.resend_api_key}
                      onChange={(value) =>
                        setFormData({ ...formData, resend_api_key: value })
                      }
                      placeholder="re_..."
                    />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="resend_from_email">Email expéditeur</Label>
                      <Input
                        id="resend_from_email"
                        type="email"
                        value={formData.resend_from_email}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            resend_from_email: e.target.value,
                          })
                        }
                        placeholder="contact@votre-domaine.fr"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="resend_from_name">Nom expéditeur</Label>
                      <Input
                        id="resend_from_name"
                        value={formData.resend_from_name}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            resend_from_name: e.target.value,
                          })
                        }
                        placeholder="Mon Organisme"
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Signitic */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    Signitic (signatures email)
                    <IntegrationStatus configured={formData.signitic_enabled && !!formData.signitic_api_key} />
                  </CardTitle>
                  <CardDescription>
                    Signatures HTML professionnelles pour vos emails
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                      <Label>Activer Signitic</Label>
                      <p className="text-sm text-muted-foreground">
                        Ajoute une signature professionnelle aux emails
                      </p>
                    </div>
                    <Switch
                      checked={formData.signitic_enabled}
                      onCheckedChange={(checked) =>
                        setFormData({ ...formData, signitic_enabled: checked })
                      }
                    />
                  </div>

                  {formData.signitic_enabled && (
                    <div className="space-y-4 p-4 border rounded-lg bg-muted/50">
                      <div className="space-y-2">
                        <Label htmlFor="signitic_api_key">Clé API Signitic</Label>
                        <SecretInput
                          id="signitic_api_key"
                          value={formData.signitic_api_key}
                          onChange={(value) =>
                            setFormData({ ...formData, signitic_api_key: value })
                          }
                          placeholder="sig_..."
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="signitic_user_email">Email utilisateur Signitic</Label>
                        <Input
                          id="signitic_user_email"
                          type="email"
                          value={formData.signitic_user_email}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              signitic_user_email: e.target.value,
                            })
                          }
                          placeholder="formateur@votre-domaine.fr"
                        />
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* AI */}
          <TabsContent value="ai">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  Google Gemini (IA)
                  <IntegrationStatus configured={formData.gemini_enabled && !!formData.gemini_api_key} />
                </CardTitle>
                <CardDescription>
                  Intelligence artificielle pour l'extraction d'objectifs et l'analyse des évaluations
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between rounded-lg border p-4">
                  <div className="space-y-0.5">
                    <Label>Activer Gemini</Label>
                    <p className="text-sm text-muted-foreground">
                      Extraction IA des objectifs depuis les programmes PDF
                    </p>
                  </div>
                  <Switch
                    checked={formData.gemini_enabled}
                    onCheckedChange={(checked) =>
                      setFormData({ ...formData, gemini_enabled: checked })
                    }
                  />
                </div>

                {formData.gemini_enabled && (
                  <div className="space-y-4 p-4 border rounded-lg bg-muted/50">
                    <div className="flex items-center justify-between">
                      <h4 className="font-medium">Configuration API Gemini</h4>
                      <a
                        href="https://makersuite.google.com/app/apikey"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-primary flex items-center gap-1"
                      >
                        Obtenir une clé API
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="gemini_api_key">Clé API Gemini</Label>
                      <SecretInput
                        id="gemini_api_key"
                        value={formData.gemini_api_key}
                        onChange={(value) =>
                          setFormData({ ...formData, gemini_api_key: value })
                        }
                        placeholder="AIza..."
                      />
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* API & Automation */}
          <TabsContent value="api">
            <div className="space-y-4">
              {/* Zapier Integration Info */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <Zap className="h-5 w-5 mr-2 text-orange-500" />
                    Zapier / Make / n8n
                    <IntegrationStatus configured={apiKeys.length > 0} />
                  </CardTitle>
                  <CardDescription>
                    Automatisez la création de formations depuis vos outils favoris
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="bg-muted/50 rounded-lg p-4 space-y-3">
                    <h4 className="font-medium">Endpoint Webhook</h4>
                    <div className="flex items-center gap-2">
                      <code className="flex-1 bg-background px-3 py-2 rounded text-sm border overflow-x-auto">
                        {window.location.origin.replace('localhost', 'your-project.supabase.co')}/functions/v1/zapier-webhook
                      </code>
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => copyToClipboard(`${window.location.origin.replace('localhost', 'your-project.supabase.co')}/functions/v1/zapier-webhook`)}
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Utilisez ce endpoint dans Zapier avec la méthode POST et une clé API dans le header <code>x-api-key</code>
                    </p>
                  </div>

                  <div className="bg-blue-50 dark:bg-blue-950/20 rounded-lg p-4 space-y-2">
                    <h4 className="font-medium text-blue-700 dark:text-blue-300">Actions disponibles</h4>
                    <ul className="text-sm space-y-1 text-blue-600 dark:text-blue-400">
                      <li>• <code>create-training</code> - Créer une nouvelle formation</li>
                      <li>• <code>add-participants</code> - Ajouter des participants</li>
                      <li>• <code>list-trainings</code> - Lister les formations</li>
                    </ul>
                  </div>
                </CardContent>
              </Card>

              {/* API Keys Management */}
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        <Key className="h-5 w-5" />
                        Clés API
                      </CardTitle>
                      <CardDescription>
                        Gérez les clés d'accès pour les intégrations externes
                      </CardDescription>
                    </div>
                    <Button onClick={() => setShowCreateKeyDialog(true)} size="sm">
                      <Plus className="h-4 w-4 mr-2" />
                      Nouvelle clé
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  {apiKeys.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <Key className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <p>Aucune clé API configurée</p>
                      <p className="text-sm">Créez une clé pour utiliser les webhooks</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {apiKeys.map((key) => (
                        <div
                          key={key.id}
                          className="flex items-center justify-between p-3 border rounded-lg"
                        >
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-medium">{key.name}</span>
                              <Badge variant={key.is_active ? "default" : "secondary"}>
                                {key.is_active ? "Active" : "Inactive"}
                              </Badge>
                            </div>
                            <div className="flex items-center gap-4 text-sm text-muted-foreground mt-1">
                              <code className="bg-muted px-2 py-0.5 rounded">{key.key_prefix}</code>
                              {key.last_used_at && (
                                <span>
                                  Dernière utilisation : {new Date(key.last_used_at).toLocaleDateString("fr-FR")}
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Switch
                              checked={key.is_active}
                              onCheckedChange={(checked) => handleToggleApiKey(key.id, checked)}
                            />
                            <AlertDialog>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Supprimer cette clé API ?</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Cette action est irréversible. Toutes les intégrations utilisant cette clé
                                    cesseront de fonctionner immédiatement.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Annuler</AlertDialogCancel>
                                  <AlertDialogAction
                                    onClick={() => handleDeleteApiKey(key.id)}
                                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                  >
                                    {deletingKeyId === key.id ? (
                                      <Loader2 className="h-4 w-4 animate-spin" />
                                    ) : (
                                      "Supprimer"
                                    )}
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="text-destructive hover:text-destructive hover:bg-destructive/10"
                              onClick={() => handleDeleteApiKey(key.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>

        {/* Create API Key Dialog */}
        <Dialog open={showCreateKeyDialog} onOpenChange={setShowCreateKeyDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Créer une clé API</DialogTitle>
              <DialogDescription>
                Donnez un nom descriptif à cette clé pour l'identifier facilement.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="keyName">Nom de la clé</Label>
                <Input
                  id="keyName"
                  value={newKeyName}
                  onChange={(e) => setNewKeyName(e.target.value)}
                  placeholder="Ex: Zapier Production"
                  autoFocus
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowCreateKeyDialog(false)}>
                Annuler
              </Button>
              <Button onClick={handleCreateApiKey} disabled={creatingKey || !newKeyName.trim()}>
                {creatingKey && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Créer la clé
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Show New Key Dialog */}
        <Dialog open={showNewKeyDialog} onOpenChange={setShowNewKeyDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-green-500" />
                Clé API créée
              </DialogTitle>
              <DialogDescription>
                Copiez cette clé maintenant. Elle ne sera plus visible après avoir fermé cette fenêtre.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="bg-yellow-50 dark:bg-yellow-950/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-3">
                <p className="text-sm text-yellow-800 dark:text-yellow-200">
                  <strong>Important :</strong> Cette clé ne sera affichée qu'une seule fois.
                  Conservez-la dans un endroit sécurisé.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <code className="flex-1 bg-muted px-3 py-2 rounded text-sm border break-all">
                  {newKeyValue}
                </code>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => copyToClipboard(newKeyValue)}
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <DialogFooter>
              <Button onClick={() => { setShowNewKeyDialog(false); setNewKeyValue(""); }}>
                J'ai copié ma clé
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Save Button (mobile) */}
        <div className="md:hidden">
          <Button onClick={handleSave} disabled={saving} className="w-full">
            {saving ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Save className="h-4 w-4 mr-2" />
            )}
            Enregistrer les modifications
          </Button>
        </div>
      </div>
    </AdminLayout>
  );
};

export default IntegrationsManagement;
