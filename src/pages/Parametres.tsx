import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { User } from "@supabase/supabase-js";
import { Loader2, ArrowLeft, Settings, Mail, Sparkles, Cog, Shield, Users, Key, Tag } from "lucide-react";
import AppHeader from "@/components/AppHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useModuleAccess } from "@/hooks/useModuleAccess";
import { fetchAllSettings, type SettingsMap } from "@/data/settings";

// Tab content components
import GeneralSettings from "@/components/settings/GeneralSettings";
import EmailTemplatesSettings from "@/components/settings/EmailTemplatesSettings";
import UserAccessManager from "@/components/settings/UserAccessManager";
import TrainerManager from "@/components/settings/TrainerManager";
import CrmTagManager from "@/components/settings/CrmTagManager";
import CrmColorSettings from "@/components/settings/CrmColorSettings";
import { ApiKeyManager } from "@/components/settings/ApiKeyManager";
import ArenaKeySettings from "@/components/settings/ArenaKeySettings";
import GoogleDriveConnect from "@/components/GoogleDriveConnect";
import GoogleCalendarConnect from "@/components/GoogleCalendarConnect";
import { Separator } from "@/components/ui/separator";
import { CardHeader, CardTitle, CardDescription, CardContent as CardContentInner } from "@/components/ui/card";

const Parametres = () => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [settings, setSettings] = useState<SettingsMap>({});
  const { hasAccess, isAdmin, loading: accessLoading } = useModuleAccess();
  const navigate = useNavigate();

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) {
        navigate("/auth");
        return;
      }
      setUser(session.user);

      try {
        const settingsData = await fetchAllSettings();
        setSettings(settingsData);
      } catch (error) {
        console.error("Error fetching settings:", error);
      }

      setLoading(false);
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

  if (loading || accessLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isAdmin && !hasAccess("parametres")) {
    return (
      <div className="min-h-screen bg-background">
        <AppHeader />
        <main className="max-w-6xl mx-auto p-6">
          <div className="flex items-center gap-4 mb-6">
            <Button variant="ghost" size="icon" onClick={() => navigate("/")}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <Settings className="h-6 w-6 text-primary" />
              </div>
              <h1 className="text-2xl font-bold">Paramètres</h1>
            </div>
          </div>
          <Card>
            <CardContent className="py-10 text-center">
              <Shield className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h2 className="text-xl font-semibold mb-2">Accès refusé</h2>
              <p className="text-muted-foreground">
                Vous n'avez pas les droits pour accéder aux paramètres généraux.
              </p>
              <Button className="mt-6" onClick={() => navigate("/")}>
                Retour au tableau de bord
              </Button>
            </CardContent>
          </Card>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <AppHeader />

      <main className="max-w-6xl mx-auto p-6">
        <div className="flex items-center gap-4 mb-6">
          <Button variant="ghost" size="icon" onClick={() => navigate("/")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <Settings className="h-6 w-6 text-primary" />
            </div>
            <h1 className="text-2xl font-bold">Paramètres</h1>
          </div>
        </div>

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
            <TabsTrigger value="arena" className="flex items-center gap-2">
              <Sparkles className="h-4 w-4" />
              AI Arena
            </TabsTrigger>
          </TabsList>

          <TabsContent value="general">
            <GeneralSettings initialSettings={settings} />
          </TabsContent>

          <TabsContent value="trainers">
            <TrainerManager />
          </TabsContent>

          <TabsContent value="crm" className="space-y-6">
            <CrmColorSettings />
            <CrmTagManager />
          </TabsContent>

          <TabsContent value="emails">
            <EmailTemplatesSettings settings={settings} />
          </TabsContent>

          {isAdmin && (
            <TabsContent value="access">
              <UserAccessManager />
            </TabsContent>
          )}

          {isAdmin && (
            <TabsContent value="integrations" className="space-y-6">
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
            </TabsContent>
          )}

          <TabsContent value="arena">
            <ArenaKeySettings />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
};

export default Parametres;
