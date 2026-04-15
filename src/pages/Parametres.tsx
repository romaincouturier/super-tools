import { Settings, Mail, Sparkles, Cog, Shield, Users, Key, Tag, Database, CreditCard, FileText, Mic, Bot } from "lucide-react";
import { Spinner } from "@/components/ui/spinner";
import PageHeader from "@/components/PageHeader";
import ModuleLayout from "@/components/ModuleLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useModuleAccess } from "@/hooks/useModuleAccess";
import { useNavigate } from "react-router-dom";
import { useSettingsManager } from "@/hooks/useSettingsManager";
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
import VoiceSettings from "@/components/settings/VoiceSettings";
import AgentIndexationSettings from "@/components/settings/AgentIndexationSettings";

const Parametres = () => {
  const navigate = useNavigate();
  const { hasAccess, isAdmin, loading: accessLoading } = useModuleAccess();
  const { loading, settings, updateSetting, hasGoogleDrive, autoSaveStatus, initialLoadDone } = useSettingsManager();

  if (loading || accessLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Spinner size="lg" className="text-primary" />
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
            <TabsTrigger value="general" className="flex items-center gap-2"><Cog className="h-4 w-4" />Général</TabsTrigger>
            <TabsTrigger value="trainers" className="flex items-center gap-2"><Users className="h-4 w-4" />Formateurs</TabsTrigger>
            <TabsTrigger value="crm" className="flex items-center gap-2"><Tag className="h-4 w-4" />CRM</TabsTrigger>
            <TabsTrigger value="emails" className="flex items-center gap-2"><Mail className="h-4 w-4" />Modèles d'emails</TabsTrigger>
            {isAdmin && <TabsTrigger value="access" className="flex items-center gap-2"><Shield className="h-4 w-4" />Accès utilisateurs</TabsTrigger>}
            {isAdmin && <TabsTrigger value="integrations" className="flex items-center gap-2"><Key className="h-4 w-4" />Intégrations</TabsTrigger>}
            {isAdmin && <TabsTrigger value="backup" className="flex items-center gap-2"><Database className="h-4 w-4" />Sauvegarde</TabsTrigger>}
            <TabsTrigger value="billing" className="flex items-center gap-2"><CreditCard className="h-4 w-4" />Abonnement</TabsTrigger>
            <TabsTrigger value="arena" className="flex items-center gap-2"><Sparkles className="h-4 w-4" />AI Arena</TabsTrigger>
            <TabsTrigger value="devis" className="flex items-center gap-2"><FileText className="h-4 w-4" />Devis</TabsTrigger>
            <TabsTrigger value="voice" className="flex items-center gap-2"><Mic className="h-4 w-4" />Voix IA</TabsTrigger>
            {isAdmin && <TabsTrigger value="agent" className="flex items-center gap-2"><Bot className="h-4 w-4" />Agent IA</TabsTrigger>}
          </TabsList>

          <TabsContent value="general">
            <SettingsGeneral settings={settings} updateSetting={updateSetting} autoSaveStatus={autoSaveStatus} />
          </TabsContent>
          <TabsContent value="trainers"><TrainerManager /></TabsContent>
          <TabsContent value="crm" className="space-y-6">
            <CrmColorSettings /><CrmTagManager /><CrmEmailTemplateManager /><EmailSnippetManager />
          </TabsContent>
          <TabsContent value="emails">
            <SettingsEmails settings={settings} loading={loading} initialLoadDone={initialLoadDone} />
          </TabsContent>
          {isAdmin && <TabsContent value="access"><UserAccessManager /></TabsContent>}
          {isAdmin && (
            <TabsContent value="integrations">
              <SettingsIntegrations settings={settings} updateSetting={updateSetting} autoSaveStatus={autoSaveStatus} />
            </TabsContent>
          )}
          {isAdmin && (
            <TabsContent value="backup">
              <BackupManager backupEnabled={settings.backup_enabled === "true"} gdriveFolderId={settings.backup_gdrive_folder_id} onSettingsChange={updateSetting} hasGoogleDrive={hasGoogleDrive} />
            </TabsContent>
          )}
          <TabsContent value="billing">
            <Card>
              <CardHeader><CardTitle>Abonnement & Facturation</CardTitle><CardDescription>Gérez votre plan et votre facturation.</CardDescription></CardHeader>
              <CardContent><BillingSection /></CardContent>
            </Card>
          </TabsContent>
          <TabsContent value="arena"><ArenaKeySettings /></TabsContent>
          <TabsContent value="devis">
            <Card>
              <CardHeader><CardTitle>Paramètres du module Devis</CardTitle><CardDescription>Données émetteur, numérotation, conditions de paiement et mentions légales injectées dans les devis.</CardDescription></CardHeader>
              <CardContent><QuoteSettingsForm /></CardContent>
            </Card>
          </TabsContent>
          <TabsContent value="voice">
            <VoiceSettings />
          </TabsContent>
          {isAdmin && <TabsContent value="agent"><AgentIndexationSettings /></TabsContent>}
        </Tabs>
      </main>
    </ModuleLayout>
  );
};

export default Parametres;
