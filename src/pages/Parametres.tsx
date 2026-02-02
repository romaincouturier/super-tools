import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { User } from "@supabase/supabase-js";
import { Loader2, ArrowLeft, Settings, Mail, Save, RotateCcw, Sparkles } from "lucide-react";
import AppHeader from "@/components/AppHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

interface EmailTemplate {
  id: string;
  template_type: string;
  template_name: string;
  subject: string;
  html_content: string;
  is_default: boolean;
}

const DEFAULT_TEMPLATES: Record<string, { name: string; subject: string; content: string; variables: string[] }> = {
  thank_you: {
    name: "Email de remerciement",
    subject: "Merci pour votre participation à la formation {{training_name}}",
    content: `Bonjour{{#first_name}} {{first_name}}{{/first_name}},

Quelle belle journée de découverte visuelle nous avons partagé ! Merci pour votre énergie et votre participation pendant notre formation "{{training_name}}".

Pour finaliser cette formation, j'ai besoin que vous preniez quelques minutes pour compléter le questionnaire d'évaluation :
{{evaluation_link}}

{{#supports_url}}
Vous trouverez également tous les supports de la formation ici, pour continuer à pratiquer et intégrer ces techniques dans vos présentations :
{{supports_url}}
{{/supports_url}}

Je suis curieux de voir comment vous allez utiliser tout ce que nous avons vu ! N'hésitez pas à me contacter si vous avez des questions ou des besoins de compléments d'informations.

Je vous souhaite une bonne journée`,
    variables: ["first_name", "training_name", "evaluation_link", "supports_url"],
  },
  needs_survey: {
    name: "Questionnaire de recueil des besoins",
    subject: "Préparez votre formation \"{{training_name}}\"",
    content: `Bonjour{{#first_name}} {{first_name}}{{/first_name}},

Vous êtes inscrit(e) à la formation "{{training_name}}" qui aura lieu le {{training_date}}.

Afin de personnaliser au mieux cette formation, je vous invite à remplir ce court questionnaire de recueil des besoins :
{{questionnaire_link}}

Ce questionnaire me permettra de mieux comprendre vos attentes et d'adapter le contenu de la formation à vos besoins spécifiques.

Je vous remercie de le compléter avant le {{deadline_date}}.

À très bientôt !`,
    variables: ["first_name", "training_name", "training_date", "questionnaire_link", "deadline_date"],
  },
  needs_survey_reminder: {
    name: "Rappel questionnaire besoins",
    subject: "Rappel : Préparez votre formation \"{{training_name}}\"",
    content: `Bonjour{{#first_name}} {{first_name}}{{/first_name}},

Je me permets de vous relancer concernant le questionnaire de préparation pour la formation "{{training_name}}".

Votre retour m'est précieux pour adapter au mieux le contenu à vos besoins.

{{questionnaire_link}}

Merci d'avance pour votre participation !`,
    variables: ["first_name", "training_name", "questionnaire_link"],
  },
  training_documents: {
    name: "Envoi des documents de formation",
    subject: "Documents de la formation \"{{training_name}}\"",
    content: `{{greeting}},

Veuillez trouver ci-joint les documents relatifs à la formation "{{training_name}}" qui s'est déroulée {{training_dates}}.

{{#has_invoice}}
- La facture
{{/has_invoice}}
{{#has_sheets}}
- Les feuilles d'émargement signées
{{/has_sheets}}

N'hésitez pas à me contacter si vous avez des questions.

Bonne réception.`,
    variables: ["greeting", "training_name", "training_dates", "has_invoice", "has_sheets"],
  },
  attendance_signature: {
    name: "Demande de signature d'émargement",
    subject: "Signature d'émargement - {{training_name}}",
    content: `Bonjour{{#first_name}} {{first_name}}{{/first_name}},

Merci de bien vouloir signer votre feuille d'émargement pour la formation "{{training_name}}" du {{session_date}}.

{{signature_link}}

Cette signature atteste de votre présence à la formation.

Merci !`,
    variables: ["first_name", "training_name", "session_date", "signature_link"],
  },
};

const Parametres = () => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [improving, setImproving] = useState<string | null>(null);
  const [templates, setTemplates] = useState<Record<string, EmailTemplate>>({});
  const [editedTemplates, setEditedTemplates] = useState<Record<string, { subject: string; content: string }>>({});
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) {
        navigate("/auth");
        return;
      }
      setUser(session.user);
      await fetchTemplates();
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

  const fetchTemplates = async () => {
    const { data, error } = await supabase
      .from("email_templates")
      .select("*");

    if (error) {
      console.error("Error fetching templates:", error);
      return;
    }

    const templatesMap: Record<string, EmailTemplate> = {};
    const editedMap: Record<string, { subject: string; content: string }> = {};
    
    data?.forEach((t) => {
      templatesMap[t.template_type] = t;
      editedMap[t.template_type] = { subject: t.subject, content: t.html_content };
    });

    // Initialize with defaults for any missing templates
    Object.keys(DEFAULT_TEMPLATES).forEach((type) => {
      if (!editedMap[type]) {
        editedMap[type] = {
          subject: DEFAULT_TEMPLATES[type].subject,
          content: DEFAULT_TEMPLATES[type].content,
        };
      }
    });

    setTemplates(templatesMap);
    setEditedTemplates(editedMap);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/auth");
  };

  const handleSaveTemplate = async (templateType: string) => {
    setSaving(templateType);
    
    try {
      const edited = editedTemplates[templateType];
      const existing = templates[templateType];

      if (existing) {
        // Update existing
        const { error } = await supabase
          .from("email_templates")
          .update({
            subject: edited.subject,
            html_content: edited.content,
            updated_at: new Date().toISOString(),
          })
          .eq("id", existing.id);

        if (error) throw error;
      } else {
        // Create new
        const { data, error } = await supabase
          .from("email_templates")
          .insert({
            template_type: templateType,
            template_name: DEFAULT_TEMPLATES[templateType].name,
            subject: edited.subject,
            html_content: edited.content,
            is_default: false,
          })
          .select()
          .single();

        if (error) throw error;
        
        setTemplates((prev) => ({ ...prev, [templateType]: data }));
      }

      toast({
        title: "Template enregistré",
        description: "Le modèle d'email a été mis à jour avec succès.",
      });
    } catch (error: any) {
      console.error("Save error:", error);
      toast({
        title: "Erreur",
        description: "Impossible d'enregistrer le template.",
        variant: "destructive",
      });
    } finally {
      setSaving(null);
    }
  };

  const handleResetTemplate = (templateType: string) => {
    const defaultTemplate = DEFAULT_TEMPLATES[templateType];
    setEditedTemplates((prev) => ({
      ...prev,
      [templateType]: {
        subject: defaultTemplate.subject,
        content: defaultTemplate.content,
      },
    }));
    
    toast({
      title: "Template réinitialisé",
      description: "Les valeurs par défaut ont été restaurées. N'oubliez pas d'enregistrer.",
    });
  };

  const updateTemplate = (templateType: string, field: "subject" | "content", value: string) => {
    setEditedTemplates((prev) => ({
      ...prev,
      [templateType]: {
        ...prev[templateType],
        [field]: value,
      },
    }));
  };

  const handleImproveWithAI = async (templateType: string) => {
    setImproving(templateType);
    
    try {
      const edited = editedTemplates[templateType];
      const templateName = DEFAULT_TEMPLATES[templateType].name;

      const { data, error } = await supabase.functions.invoke("improve-email-content", {
        body: {
          subject: edited.subject,
          content: edited.content,
          templateType,
          templateName,
        },
      });

      if (error) throw error;

      if (data.error) {
        throw new Error(data.error);
      }

      setEditedTemplates((prev) => ({
        ...prev,
        [templateType]: {
          subject: data.subject,
          content: data.content,
        },
      }));

      toast({
        title: "Contenu amélioré",
        description: "L'IA a proposé des améliorations. Vérifiez et enregistrez si satisfait.",
      });
    } catch (error: any) {
      console.error("AI improvement error:", error);
      toast({
        title: "Erreur",
        description: error.message || "Impossible d'améliorer le contenu avec l'IA.",
        variant: "destructive",
      });
    } finally {
      setImproving(null);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <AppHeader user={user} onLogout={handleLogout} />

      {/* Main content */}
      <main className="max-w-6xl mx-auto p-6">
        {/* Back button and title */}
        <div className="flex items-center gap-4 mb-6">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate("/")}
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <Settings className="h-6 w-6 text-primary" />
            </div>
            <h1 className="text-2xl font-bold">Paramètres</h1>
          </div>
        </div>

        <Tabs defaultValue="emails" className="space-y-6">
          <TabsList>
            <TabsTrigger value="emails" className="flex items-center gap-2">
              <Mail className="h-4 w-4" />
              Modèles d'emails
            </TabsTrigger>
          </TabsList>

          <TabsContent value="emails">
            <Card>
              <CardHeader>
                <CardTitle>Personnalisation des emails</CardTitle>
                <CardDescription>
                  Modifiez le contenu des emails automatiques envoyés par l'application.
                  Utilisez les variables entre doubles accolades (ex: {"{{first_name}}"}) pour insérer des données dynamiques.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Accordion type="single" collapsible className="w-full">
                  {Object.entries(DEFAULT_TEMPLATES).map(([type, defaultTemplate]) => (
                    <AccordionItem key={type} value={type}>
                      <AccordionTrigger className="text-left">
                        <div className="flex items-center gap-3">
                          <Mail className="h-4 w-4 text-muted-foreground" />
                          <span>{defaultTemplate.name}</span>
                          {templates[type] && (
                            <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded">
                              Personnalisé
                            </span>
                          )}
                        </div>
                      </AccordionTrigger>
                      <AccordionContent className="space-y-4 pt-4">
                        {/* Subject */}
                        <div className="space-y-2">
                          <Label>Objet de l'email</Label>
                          <Input
                            value={editedTemplates[type]?.subject || ""}
                            onChange={(e) => updateTemplate(type, "subject", e.target.value)}
                            placeholder="Objet du mail..."
                          />
                        </div>

                        {/* Content */}
                        <div className="space-y-2">
                          <Label>Contenu de l'email</Label>
                          <Textarea
                            value={editedTemplates[type]?.content || ""}
                            onChange={(e) => updateTemplate(type, "content", e.target.value)}
                            placeholder="Contenu du mail..."
                            className="min-h-[200px] font-mono text-sm"
                          />
                        </div>

                        {/* Variables */}
                        <div className="space-y-2">
                          <Label className="text-muted-foreground">Variables disponibles</Label>
                          <div className="flex flex-wrap gap-2">
                            {defaultTemplate.variables.map((variable) => (
                              <code
                                key={variable}
                                className="px-2 py-1 bg-muted rounded text-xs"
                              >
                                {`{{${variable}}}`}
                              </code>
                            ))}
                          </div>
                        </div>

                        {/* Actions */}
                        <div className="flex flex-wrap gap-2 pt-2">
                          <Button
                            onClick={() => handleSaveTemplate(type)}
                            disabled={saving === type || improving === type}
                          >
                            {saving === type ? (
                              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            ) : (
                              <Save className="h-4 w-4 mr-2" />
                            )}
                            Enregistrer
                          </Button>
                          <Button
                            variant="secondary"
                            onClick={() => handleImproveWithAI(type)}
                            disabled={improving === type || saving === type}
                          >
                            {improving === type ? (
                              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            ) : (
                              <Sparkles className="h-4 w-4 mr-2" />
                            )}
                            Améliorer avec l'IA
                          </Button>
                          <Button
                            variant="outline"
                            onClick={() => handleResetTemplate(type)}
                            disabled={saving === type || improving === type}
                          >
                            <RotateCcw className="h-4 w-4 mr-2" />
                            Réinitialiser
                          </Button>
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
};

export default Parametres;
