import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { User } from "@supabase/supabase-js";
import { Loader2, Settings, Mail, Sparkles, Cog, Shield, Users, Key, Tag, Database, CreditCard, FileText } from "lucide-react";
import PageHeader from "@/components/PageHeader";
import ModuleLayout from "@/components/ModuleLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useModuleAccess } from "@/hooks/useModuleAccess";
import { SETTINGS_REGISTRY, SETTINGS_DEFAULTS } from "@/components/settings/settingsConstants";

// Tab content components
import SettingsGeneral from "@/components/settings/SettingsGeneral";
import TrainerManager from "@/components/settings/TrainerManager";
import CrmColorSettings from "@/components/settings/CrmColorSettings";
import CrmTagManager from "@/components/settings/CrmTagManager";
import CrmEmailTemplateManager from "@/components/settings/CrmEmailTemplateManager";
import EmailSnippetManager from "@/components/settings/EmailSnippetManager";
import SettingsEmails from "@/components/settings/SettingsEmails";
import UserAccessManager from "@/components/settings/UserAccessManager";
import SettingsIntegrations from "@/components/settings/SettingsIntegrations";
import BackupManager from "@/components/settings/BackupManager";
import BillingSection from "@/components/settings/BillingSection";
import ArenaKeySettings from "@/components/settings/ArenaKeySettings";
import QuoteSettingsForm from "@/components/quotes/QuoteSettingsForm";

const Parametres = () => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [settings, setSettings] = useState<Record<string, string>>(SETTINGS_DEFAULTS);
  const [hasGoogleDrive, setHasGoogleDrive] = useState(false);

  // Auto-save infrastructure
  const initialLoadDoneRef = useRef(false);
  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [autoSaveStatus, setAutoSaveStatus] = useState<"idle" | "saving" | "saved">("idle");

  const { hasAccess, isAdmin, loading: accessLoading } = useModuleAccess();
  const navigate = useNavigate();

  const updateSetting = useCallback((key: string, value: string) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  }, []);

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) {
        navigate("/auth");
        return;
      }
      setUser(session.user);
      await Promise.all([fetchSettings()]);
      const { count } = await supabase.from("google_drive_tokens").select("*", { count: "exact", head: true });
      setHasGoogleDrive((count ?? 0) > 0);
      setLoading(false);
      initialLoadDoneRef.current = true;
    };

    checkAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (!session?.user) {
          navigate("/auth");
        } else {
          setUser(session.user);
        }
      }
    );

    return () => subscription.unsubscribe();
  }, [navigate]);

  const fetchSettings = async () => {
    const { data, error } = await supabase
      .from("app_settings")
      .select("setting_key, setting_value")
      .in("setting_key", Object.keys(SETTINGS_REGISTRY));

    if (error) {
      console.error("Error fetching settings:", error);
      return;
    }

    const loaded: Record<string, string> = {};
    data?.forEach((s) => {
      loaded[s.setting_key] = s.setting_value || SETTINGS_REGISTRY[s.setting_key]?.default || "";
    });
    setSettings(prev => ({ ...prev, ...loaded }));
  };

  // Silent auto-save for general settings (no toast on success)
  const autoSaveSettings = useCallback(async () => {
    setAutoSaveStatus("saving");
    try {
      const settingsToSave = Object.entries(SETTINGS_REGISTRY).map(([key, { description }]) => ({
        setting_key: key,
        setting_value: settings[key] || "",
        description,
      }));

      await Promise.all(
        settingsToSave.map(setting =>
          supabase.from("app_settings").upsert(setting, { onConflict: "setting_key" })
        )
      );

      setAutoSaveStatus("saved");
      setTimeout(() => setAutoSaveStatus("idle"), 2000);
    } catch (error: unknown) {
      console.error("Auto-save settings error:", error);
      setAutoSaveStatus("idle");
    }
  }, [settings]);

  // Auto-save effect for general settings (debounced 1.5s)
  useEffect(() => {
    if (!initialLoadDoneRef.current || loading) return;

    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current);
    }

    setAutoSaveStatus("idle");
    autoSaveTimerRef.current = setTimeout(() => {
      autoSaveSettings();
    }, 1500);

    return () => {
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
      }
    };
  }, [autoSaveSettings, loading]);

  if (loading || accessLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isAdmin && !hasAccess("parametres")) {
    return (
      <ModuleLayout>
        <main className="max-w-6xl mx-auto p-6">
          <PageHeader icon={Settings} title="Paramètres" />
          <Card>
            <CardContent className="py-10 text-center">
              <Shield className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h2 className="text-xl font-semibold mb-2">Accès refusé</h2>
              <p className="text-muted-foreground">
                Vous n'avez pas les droits pour accéder aux paramètres généraux.
              </p>
              <Button className="mt-6" onClick={() => navigate("/dashboard")}>
                Retour au tableau de bord
              </Button>
            </CardContent>
          </Card>
        </main>
      </ModuleLayout>
    );
  }

  return (
    <ModuleLayout>
      <main className="max-w-6xl mx-auto p-6">
        <PageHeader icon={Settings} title="Paramètres" />

        <Tabs defaultValue="general" className="space-y-6">
          <TabsList className="flex flex-wrap h-auto gap-1">
            <TabsTrigger value="general" className="flex items-center gap-2">
              <Cog className="h-4 w-4" />
              Général
            </TabsTrigger>
            <TabsTrigger value="trainers" className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              Formateurs
            </TabsTrigger>
            <TabsTrigger value="crm" className="flex items-center gap-2">
              <Tag className="h-4 w-4" />
              CRM
            </TabsTrigger>
            <TabsTrigger value="emails" className="flex items-center gap-2">
              <Mail className="h-4 w-4" />
              Modèles d'emails
            </TabsTrigger>
            {isAdmin && (
              <TabsTrigger value="access" className="flex items-center gap-2">
                <Shield className="h-4 w-4" />
                Accès utilisateurs
              </TabsTrigger>
            )}
            {isAdmin && (
              <TabsTrigger value="integrations" className="flex items-center gap-2">
                <Key className="h-4 w-4" />
                Intégrations
              </TabsTrigger>
            )}
            {isAdmin && (
              <TabsTrigger value="backup" className="flex items-center gap-2">
                <Database className="h-4 w-4" />
                Sauvegarde
              </TabsTrigger>
            )}
            <TabsTrigger value="billing" className="flex items-center gap-2">
              <CreditCard className="h-4 w-4" />
              Abonnement
            </TabsTrigger>
            <TabsTrigger value="arena" className="flex items-center gap-2">
              <Sparkles className="h-4 w-4" />
              AI Arena
            </TabsTrigger>
            <TabsTrigger value="devis" className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Devis
            </TabsTrigger>
          </TabsList>

          <TabsContent value="general">
            <SettingsGeneral
              settings={settings}
              updateSetting={updateSetting}
              autoSaveStatus={autoSaveStatus}
            />
          </TabsContent>

          <TabsContent value="trainers">
            <TrainerManager />
          </TabsContent>

          <TabsContent value="crm" className="space-y-6">
            <CrmColorSettings />
            <CrmTagManager />
            <CrmEmailTemplateManager />
            <EmailSnippetManager />
          </TabsContent>

          <TabsContent value="emails">
            <SettingsEmails
              settings={settings}
              loading={loading}
              initialLoadDone={initialLoadDoneRef.current}
            />
          </TabsContent>

          {isAdmin && (
            <TabsContent value="access">
              <UserAccessManager />
            </TabsContent>
          )}

          {isAdmin && (
            <TabsContent value="integrations">
              <SettingsIntegrations
                settings={settings}
                updateSetting={updateSetting}
                autoSaveStatus={autoSaveStatus}
              />
            </TabsContent>
          )}

          {isAdmin && (
            <TabsContent value="backup">
              <BackupManager
                backupEnabled={settings.backup_enabled === "true"}
                gdriveFolderId={settings.backup_gdrive_folder_id}
                onSettingsChange={updateSetting}
                hasGoogleDrive={hasGoogleDrive}
              />
            </TabsContent>
          )}

          <TabsContent value="billing">
            <Card>
              <CardHeader>
                <CardTitle>Abonnement & Facturation</CardTitle>
                <CardDescription>
                  Gérez votre plan et votre facturation.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <BillingSection />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="arena">
            <ArenaKeySettings />
          </TabsContent>

          <TabsContent value="devis">
            <Card>
              <CardHeader>
                <CardTitle>Paramètres du module Devis</CardTitle>
                <CardDescription>
                  Données émetteur, numérotation, conditions de paiement et mentions légales injectées dans les devis.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <QuoteSettingsForm />
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </ModuleLayout>
  );
};

export default Parametres;
