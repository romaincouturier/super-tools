import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import AdminLayout from "@/components/admin/AdminLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Pencil, Eye, Mail, RefreshCw, Info } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface EmailTemplate {
  id: string;
  template_type: string;
  name: string;
  subject: string;
  body_html: string;
  body_text: string | null;
  variables: string[];
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

const templateTypeLabels: Record<string, string> = {
  needs_survey: "Questionnaire de besoins",
  needs_survey_reminder: "Relance questionnaire",
  welcome: "Email de bienvenue (J-7)",
  thank_you: "Remerciement post-formation",
  evaluation_reminder: "Relance évaluation",
  certificate: "Envoi certificat",
  sponsor_feedback: "Feedback commanditaire",
  google_review_request: "Demande avis Google",
  video_testimonial_request: "Demande témoignage vidéo",
  cold_evaluation: "Évaluation à froid",
  training_documents: "Documents de formation",
};

const templateTypeDescriptions: Record<string, string> = {
  needs_survey: "Envoyé aux participants pour recueillir leurs besoins avant la formation",
  needs_survey_reminder: "Relance si le questionnaire n'a pas été complété",
  welcome: "Email logistique envoyé 7 jours avant la formation",
  thank_you: "Envoyé après la formation avec le lien d'évaluation",
  evaluation_reminder: "Relance si l'évaluation n'a pas été complétée (J+2, J+4)",
  certificate: "Accompagne l'envoi du certificat de réalisation",
  sponsor_feedback: "Demande de feedback au commanditaire après la formation",
  google_review_request: "Demande d'avis Google (J+1 après évaluation)",
  video_testimonial_request: "Demande de témoignage vidéo (J+7 après évaluation)",
  cold_evaluation: "Évaluation à froid (J+20 après formation)",
  training_documents: "Envoi de documents administratifs",
};

const EmailTemplatesManagement = () => {
  const [loading, setLoading] = useState(true);
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [organizationId, setOrganizationId] = useState<string | null>(null);
  const [showDialog, setShowDialog] = useState(false);
  const [showPreviewDialog, setShowPreviewDialog] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<EmailTemplate | null>(null);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  const [formData, setFormData] = useState({
    name: "",
    subject: "",
    body_html: "",
    is_active: true,
  });

  const fetchTemplates = async (orgId: string) => {
    const { data, error } = await supabase
      .from("email_templates")
      .select("*")
      .eq("organization_id", orgId)
      .order("template_type", { ascending: true });

    if (error) {
      console.error("Error fetching templates:", error);
      return;
    }

    setTemplates(data || []);
  };

  useEffect(() => {
    const init = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const { data: profile } = await supabase
          .from("user_profiles")
          .select("organization_id")
          .eq("id", user.id)
          .single();

        if (profile?.organization_id) {
          setOrganizationId(profile.organization_id);
          await fetchTemplates(profile.organization_id);
        }
      } catch (error) {
        console.error("Error initializing:", error);
      } finally {
        setLoading(false);
      }
    };

    init();
  }, []);

  const openEditDialog = (template: EmailTemplate) => {
    setSelectedTemplate(template);
    setFormData({
      name: template.name,
      subject: template.subject,
      body_html: template.body_html,
      is_active: template.is_active,
    });
    setShowDialog(true);
  };

  const openPreviewDialog = (template: EmailTemplate) => {
    setSelectedTemplate(template);
    setShowPreviewDialog(true);
  };

  const handleSave = async () => {
    if (!selectedTemplate || !organizationId) return;

    setSaving(true);
    try {
      const { error } = await supabase
        .from("email_templates")
        .update({
          name: formData.name,
          subject: formData.subject,
          body_html: formData.body_html,
          is_active: formData.is_active,
          updated_at: new Date().toISOString(),
        })
        .eq("id", selectedTemplate.id);

      if (error) throw error;

      await fetchTemplates(organizationId);

      toast({
        title: "Template mis à jour",
        description: "Les modifications ont été enregistrées.",
      });

      setShowDialog(false);
    } catch (error) {
      console.error("Error saving template:", error);
      toast({
        title: "Erreur",
        description: "Impossible d'enregistrer les modifications.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleResetToDefault = async (template: EmailTemplate) => {
    if (!organizationId) return;

    try {
      // Call function to reset template to default
      const { error } = await supabase.rpc("reset_email_template_to_default", {
        p_template_id: template.id,
        p_org_id: organizationId,
      });

      if (error) throw error;

      await fetchTemplates(organizationId);

      toast({
        title: "Template réinitialisé",
        description: "Le template a été remis à sa valeur par défaut.",
      });
    } catch (error) {
      console.error("Error resetting template:", error);
      toast({
        title: "Erreur",
        description: "Impossible de réinitialiser le template.",
        variant: "destructive",
      });
    }
  };

  const replaceVariablesForPreview = (html: string) => {
    const sampleData: Record<string, string> = {
      "{{participant_first_name}}": "Marie",
      "{{participant_last_name}}": "Dupont",
      "{{training_name}}": "Management d'équipe",
      "{{training_date}}": "15 février 2026",
      "{{training_location}}": "Paris 9e",
      "{{training_hours}}": "9h00 - 17h30",
      "{{survey_link}}": "#",
      "{{evaluation_link}}": "#",
      "{{feedback_link}}": "#",
      "{{deadline}}": "10 février 2026",
      "{{trainer_name}}": "Romain Couturier",
      "{{sponsor_first_name}}": "Jean",
      "{{end_date}}": "16 février 2026",
    };

    let result = html;
    Object.entries(sampleData).forEach(([key, value]) => {
      result = result.replace(new RegExp(key.replace(/[{}]/g, "\\$&"), "g"), value);
    });
    return result;
  };

  if (loading) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </AdminLayout>
    );
  }

  // Group templates by category
  const participantTemplates = templates.filter(t =>
    ["needs_survey", "needs_survey_reminder", "welcome", "thank_you", "evaluation_reminder", "certificate"].includes(t.template_type)
  );

  const followUpTemplates = templates.filter(t =>
    ["google_review_request", "video_testimonial_request", "cold_evaluation"].includes(t.template_type)
  );

  const otherTemplates = templates.filter(t =>
    ["sponsor_feedback", "training_documents"].includes(t.template_type)
  );

  const TemplateCard = ({ template }: { template: EmailTemplate }) => (
    <Card className={!template.is_active ? "opacity-60" : ""}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <CardTitle className="text-base">{template.name}</CardTitle>
              {!template.is_active && (
                <Badge variant="secondary">Désactivé</Badge>
              )}
            </div>
            <CardDescription className="text-xs">
              {templateTypeDescriptions[template.template_type]}
            </CardDescription>
          </div>
          <div className="flex gap-1">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => openPreviewDialog(template)}
                  >
                    <Eye className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Aperçu</TooltipContent>
              </Tooltip>
            </TooltipProvider>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => openEditDialog(template)}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Modifier</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          <div>
            <span className="text-xs text-muted-foreground">Objet :</span>
            <p className="text-sm font-medium truncate">{template.subject}</p>
          </div>
          <div className="flex flex-wrap gap-1">
            {template.variables?.slice(0, 4).map((variable, idx) => (
              <Badge key={idx} variant="outline" className="text-xs">
                {`{{${variable}}}`}
              </Badge>
            ))}
            {template.variables && template.variables.length > 4 && (
              <Badge variant="outline" className="text-xs">
                +{template.variables.length - 4}
              </Badge>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold">Templates d'emails</h2>
          <p className="text-sm text-muted-foreground">
            Personnalisez les emails envoyés automatiquement par l'application
          </p>
        </div>

        <Card className="bg-blue-50 border-blue-200">
          <CardContent className="pt-6">
            <div className="flex gap-3">
              <Info className="h-5 w-5 text-blue-600 shrink-0 mt-0.5" />
              <div>
                <h4 className="font-medium text-blue-800">Variables disponibles</h4>
                <p className="text-sm text-blue-700 mt-1">
                  Utilisez les variables entre double accolades pour personnaliser vos emails.
                  Par exemple : <code className="bg-blue-100 px-1 rounded">{`{{participant_first_name}}`}</code> sera
                  remplacé par le prénom du participant.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Tabs defaultValue="participants" className="space-y-4">
          <TabsList className="w-full flex overflow-x-auto">
            <TabsTrigger value="participants" className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0 text-xs sm:text-sm">
              <Mail className="h-4 w-4 hidden sm:inline" />
              Participants ({participantTemplates.length})
            </TabsTrigger>
            <TabsTrigger value="followup" className="flex-shrink-0 text-xs sm:text-sm">
              Suivi ({followUpTemplates.length})
            </TabsTrigger>
            <TabsTrigger value="other" className="flex-shrink-0 text-xs sm:text-sm">
              Autres ({otherTemplates.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="participants">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {participantTemplates.map(template => (
                <TemplateCard key={template.id} template={template} />
              ))}
            </div>
          </TabsContent>

          <TabsContent value="followup">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {followUpTemplates.map(template => (
                <TemplateCard key={template.id} template={template} />
              ))}
            </div>
          </TabsContent>

          <TabsContent value="other">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {otherTemplates.map(template => (
                <TemplateCard key={template.id} template={template} />
              ))}
            </div>
          </TabsContent>
        </Tabs>

        {/* Edit Dialog */}
        <Dialog open={showDialog} onOpenChange={setShowDialog}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Modifier le template</DialogTitle>
              <DialogDescription>
                {selectedTemplate && templateTypeLabels[selectedTemplate.template_type]}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Nom du template</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="subject">Objet de l'email</Label>
                <Input
                  id="subject"
                  value={formData.subject}
                  onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                />
                <p className="text-xs text-muted-foreground">
                  Vous pouvez utiliser des variables comme {`{{training_name}}`}
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="body">Contenu HTML</Label>
                <Textarea
                  id="body"
                  value={formData.body_html}
                  onChange={(e) => setFormData({ ...formData, body_html: e.target.value })}
                  rows={12}
                  className="font-mono text-sm"
                />
              </div>
              {selectedTemplate?.variables && (
                <div className="space-y-2">
                  <Label>Variables disponibles</Label>
                  <div className="flex flex-wrap gap-1">
                    {selectedTemplate.variables.map((variable, idx) => (
                      <Badge
                        key={idx}
                        variant="outline"
                        className="cursor-pointer hover:bg-muted"
                        onClick={() => {
                          navigator.clipboard.writeText(`{{${variable}}}`);
                          toast({ title: "Copié !", description: `{{${variable}}} copié dans le presse-papier` });
                        }}
                      >
                        {`{{${variable}}}`}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
              <div className="flex items-center justify-between rounded-lg border p-4">
                <div className="space-y-0.5">
                  <Label>Template actif</Label>
                  <p className="text-sm text-muted-foreground">
                    Désactiver ce template empêchera l'envoi de ce type d'email
                  </p>
                </div>
                <Switch
                  checked={formData.is_active}
                  onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
                />
              </div>
            </div>
            <DialogFooter className="flex-col sm:flex-row gap-2">
              <Button
                variant="outline"
                onClick={() => selectedTemplate && handleResetToDefault(selectedTemplate)}
                className="sm:mr-auto"
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Réinitialiser
              </Button>
              <Button variant="outline" onClick={() => setShowDialog(false)}>
                Annuler
              </Button>
              <Button onClick={handleSave} disabled={saving}>
                {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Enregistrer
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Preview Dialog */}
        <Dialog open={showPreviewDialog} onOpenChange={setShowPreviewDialog}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Aperçu de l'email</DialogTitle>
              <DialogDescription>
                {selectedTemplate && templateTypeLabels[selectedTemplate.template_type]}
              </DialogDescription>
            </DialogHeader>
            {selectedTemplate && (
              <div className="space-y-4">
                <div className="p-3 bg-muted rounded-lg">
                  <span className="text-sm font-medium">Objet : </span>
                  <span className="text-sm">
                    {replaceVariablesForPreview(selectedTemplate.subject)}
                  </span>
                </div>
                <div className="border rounded-lg p-4 bg-white">
                  <div
                    className="prose prose-sm max-w-none"
                    dangerouslySetInnerHTML={{
                      __html: replaceVariablesForPreview(selectedTemplate.body_html),
                    }}
                  />
                </div>
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowPreviewDialog(false)}>
                Fermer
              </Button>
              <Button onClick={() => {
                setShowPreviewDialog(false);
                if (selectedTemplate) openEditDialog(selectedTemplate);
              }}>
                <Pencil className="h-4 w-4 mr-2" />
                Modifier
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AdminLayout>
  );
};

export default EmailTemplatesManagement;
