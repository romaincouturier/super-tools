import { useState, useEffect, useRef, useCallback } from "react";
import { Loader2, Mail, RotateCcw, Sparkles } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { supabase } from "@/integrations/supabase/client";
import PostEvaluationEmailManager from "@/components/settings/PostEvaluationEmailManager";
import { AutoSaveIndicator } from "@/components/settings/SettingsAutoSaveIndicator";
import { DEFAULT_TEMPLATES, type EmailTemplate, type AddressMode, type TemplateConfig } from "@/components/settings/settingsConstants";

interface SettingsEmailsProps {
  settings: Record<string, string>;
  loading: boolean;
  initialLoadDone: boolean;
}

const SettingsEmails = ({ settings, loading, initialLoadDone }: SettingsEmailsProps) => {
  const { toast } = useToast();
  const [saving, setSaving] = useState<string | null>(null);
  const [improving, setImproving] = useState<string | null>(null);
  const [templates, setTemplates] = useState<Record<string, Record<AddressMode, EmailTemplate | null>>>({});
  const [editedTemplates, setEditedTemplates] = useState<Record<string, Record<AddressMode, { subject: string; content: string }>>>({});
  const [activeMode, setActiveMode] = useState<Record<string, AddressMode>>({});

  // Auto-save infrastructure
  const templateAutoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastEditedTemplateRef = useRef<{ type: string; mode: AddressMode } | null>(null);
  const [templateAutoSaveStatus, setTemplateAutoSaveStatus] = useState<"idle" | "saving" | "saved">("idle");
  const templatesLoadedRef = useRef(false);

  // Fetch templates on mount
  useEffect(() => {
    fetchTemplates();
  }, []);

  const fetchTemplates = async () => {
    const { data, error } = await supabase
      .from("email_templates")
      .select("*");

    if (error) {
      console.error("Error fetching templates:", error);
      return;
    }

    const templatesMap: Record<string, Record<AddressMode, EmailTemplate | null>> = {};
    const editedMap: Record<string, Record<AddressMode, { subject: string; content: string }>> = {};
    const modeMap: Record<string, AddressMode> = {};

    // Group templates by base type and mode
    data?.forEach((t) => {
      const isVous = t.template_type.endsWith("_vous");
      const isTu = t.template_type.endsWith("_tu");
      const mode: AddressMode = isVous ? "vous" : isTu ? "tu" : "vous";
      const baseType = isVous ? t.template_type.replace("_vous", "") : isTu ? t.template_type.replace("_tu", "") : t.template_type;

      if (!templatesMap[baseType]) {
        templatesMap[baseType] = { tu: null, vous: null };
      }
      if (!editedMap[baseType]) {
        editedMap[baseType] = {
          tu: { subject: "", content: "" },
          vous: { subject: "", content: "" },
        };
      }

      templatesMap[baseType][mode] = t;
      editedMap[baseType][mode] = { subject: t.subject, content: t.html_content };
    });

    // Initialize with defaults for any missing templates
    Object.keys(DEFAULT_TEMPLATES).forEach((type) => {
      if (!templatesMap[type]) {
        templatesMap[type] = { tu: null, vous: null };
      }
      if (!editedMap[type]) {
        editedMap[type] = {
          tu: { subject: DEFAULT_TEMPLATES[type].subject.tu, content: DEFAULT_TEMPLATES[type].content.tu },
          vous: { subject: DEFAULT_TEMPLATES[type].subject.vous, content: DEFAULT_TEMPLATES[type].content.vous },
        };
      } else {
        // Fill in missing modes with defaults
        if (!editedMap[type].tu.subject) {
          editedMap[type].tu = { subject: DEFAULT_TEMPLATES[type].subject.tu, content: DEFAULT_TEMPLATES[type].content.tu };
        }
        if (!editedMap[type].vous.subject) {
          editedMap[type].vous = { subject: DEFAULT_TEMPLATES[type].subject.vous, content: DEFAULT_TEMPLATES[type].content.vous };
        }
      }
      modeMap[type] = "vous"; // Default to vous
    });

    setTemplates(templatesMap);
    setEditedTemplates(editedMap);
    setActiveMode(modeMap);
    templatesLoadedRef.current = true;
  };

  // Silent auto-save for email templates
  const autoSaveTemplate = useCallback(async (templateType: string, mode: AddressMode) => {
    setTemplateAutoSaveStatus("saving");
    try {
      const edited = editedTemplates[templateType]?.[mode];
      const existing = templates[templateType]?.[mode];
      const templateTypeWithMode = `${templateType}_${mode}`;

      if (existing) {
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
        const { data, error } = await supabase
          .from("email_templates")
          .insert({
            template_type: templateTypeWithMode,
            template_name: `${DEFAULT_TEMPLATES[templateType].name} (${mode === "tu" ? "tutoiement" : "vouvoiement"})`,
            subject: edited.subject,
            html_content: edited.content,
            is_default: false,
          })
          .select()
          .single();

        if (error) throw error;

        setTemplates((prev) => ({
          ...prev,
          [templateType]: {
            ...prev[templateType],
            [mode]: data,
          },
        }));
      }

      setTemplateAutoSaveStatus("saved");
      setTimeout(() => setTemplateAutoSaveStatus("idle"), 2000);
    } catch (error: unknown) {
      console.error("Auto-save template error:", error);
      setTemplateAutoSaveStatus("idle");
    }
  }, [editedTemplates, templates]);

  // Auto-save effect for email templates (debounced 2s)
  useEffect(() => {
    if (!initialLoadDone || loading || !lastEditedTemplateRef.current || !templatesLoadedRef.current) return;

    if (templateAutoSaveTimerRef.current) {
      clearTimeout(templateAutoSaveTimerRef.current);
    }

    const { type, mode } = lastEditedTemplateRef.current;

    templateAutoSaveTimerRef.current = setTimeout(() => {
      autoSaveTemplate(type, mode);
    }, 2000);

    return () => {
      if (templateAutoSaveTimerRef.current) {
        clearTimeout(templateAutoSaveTimerRef.current);
      }
    };
  }, [editedTemplates, autoSaveTemplate, loading, initialLoadDone]);

  const handleSaveTemplate = async (templateType: string, mode: AddressMode) => {
    const saveKey = `${templateType}_${mode}`;
    setSaving(saveKey);

    try {
      const edited = editedTemplates[templateType]?.[mode];
      const existing = templates[templateType]?.[mode];
      const templateTypeWithMode = `${templateType}_${mode}`;

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
            template_type: templateTypeWithMode,
            template_name: `${DEFAULT_TEMPLATES[templateType].name} (${mode === "tu" ? "tutoiement" : "vouvoiement"})`,
            subject: edited.subject,
            html_content: edited.content,
            is_default: false,
          })
          .select()
          .single();

        if (error) throw error;

        setTemplates((prev) => ({
          ...prev,
          [templateType]: {
            ...prev[templateType],
            [mode]: data,
          },
        }));
      }

      toast({
        title: "Template enregistré",
        description: `Le modèle d'email (${mode === "tu" ? "tutoiement" : "vouvoiement"}) a été mis à jour avec succès.`,
      });
    } catch (error: unknown) {
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

  const handleResetTemplate = (templateType: string, mode: AddressMode) => {
    const defaultTemplate = DEFAULT_TEMPLATES[templateType];
    setEditedTemplates((prev) => ({
      ...prev,
      [templateType]: {
        ...prev[templateType],
        [mode]: {
          subject: defaultTemplate.subject[mode],
          content: defaultTemplate.content[mode],
        },
      },
    }));

    toast({
      title: "Template réinitialisé",
      description: "Les valeurs par défaut ont été restaurées. N'oubliez pas d'enregistrer.",
    });
  };

  const updateTemplate = (templateType: string, mode: AddressMode, field: "subject" | "content", value: string) => {
    lastEditedTemplateRef.current = { type: templateType, mode };
    setEditedTemplates((prev) => ({
      ...prev,
      [templateType]: {
        ...prev[templateType],
        [mode]: {
          ...prev[templateType]?.[mode],
          [field]: value,
        },
      },
    }));
  };

  const handleImproveWithAI = async (templateType: string, mode: AddressMode) => {
    const improveKey = `${templateType}_${mode}`;
    setImproving(improveKey);

    try {
      const edited = editedTemplates[templateType]?.[mode];
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
          ...prev[templateType],
          [mode]: {
            subject: data.subject,
            content: data.content,
          },
        },
      }));

      toast({
        title: "Contenu amélioré",
        description: "L'IA a proposé des améliorations. Vérifiez et enregistrez si satisfait.",
      });
    } catch (error: unknown) {
      console.error("AI improvement error:", error);
      toast({
        title: "Erreur",
        description: error instanceof Error ? error.message : "Erreur inconnue",
        variant: "destructive",
      });
    } finally {
      setImproving(null);
    }
  };

  const renderTemplateEditor = (type: string, defaultTemplate: TemplateConfig, currentMode: AddressMode, saveKey: string) => (
    <>
      {/* Tu/Vous tabs */}
      <div className="flex items-center gap-2 mb-4">
        <span className="text-sm text-muted-foreground">Version :</span>
        <Tabs
          value={currentMode}
          onValueChange={(v) => setActiveMode((prev) => ({ ...prev, [type]: v as AddressMode }))}
        >
          <TabsList className="h-8">
            <TabsTrigger value="tu" className="text-xs px-3 h-7">
              Tutoiement
            </TabsTrigger>
            <TabsTrigger value="vous" className="text-xs px-3 h-7">
              Vouvoiement
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Subject */}
      <div className="space-y-2">
        <Label>Objet de l'email</Label>
        <Input
          value={editedTemplates[type]?.[currentMode]?.subject || ""}
          onChange={(e) => updateTemplate(type, currentMode, "subject", e.target.value)}
          placeholder="Objet du mail..."
        />
      </div>

      {/* Content */}
      <div className="space-y-2">
        <Label>Contenu de l'email</Label>
        <Textarea
          value={editedTemplates[type]?.[currentMode]?.content || ""}
          onChange={(e) => updateTemplate(type, currentMode, "content", e.target.value)}
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
      <div className="flex flex-wrap gap-2 pt-2 items-center">
        <AutoSaveIndicator status={templateAutoSaveStatus} />
        <Button
          variant="secondary"
          onClick={() => handleImproveWithAI(type, currentMode)}
          disabled={improving === saveKey || saving === saveKey}
        >
          {improving === saveKey ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Sparkles className="h-4 w-4 mr-2" />
          )}
          Améliorer avec l'IA
        </Button>
        <Button
          variant="outline"
          onClick={() => handleResetTemplate(type, currentMode)}
          disabled={saving === saveKey || improving === saveKey}
        >
          <RotateCcw className="h-4 w-4 mr-2" />
          Réinitialiser
        </Button>
      </div>
    </>
  );

  const renderTimingSection = (
    timingFilter: TemplateConfig["timing"],
    title: string,
    badgeStyle: string,
    showDelay: boolean,
    delayPrefix: string
  ) => (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
        {title}
      </h3>
      <Accordion type="single" collapsible className="w-full">
        {Object.entries(DEFAULT_TEMPLATES)
          .filter(([, t]) => t.timing === timingFilter)
          .map(([type, defaultTemplate]) => {
            const currentMode = activeMode[type] || "vous";
            const saveKey = `${type}_${currentMode}`;
            const isCustomized = templates[type]?.tu || templates[type]?.vous;

            const delayValue = defaultTemplate.delayKey ? (settings[defaultTemplate.delayKey] || null) : null;
            const timingLabel = showDelay && delayValue ? `${delayPrefix}${delayValue}` : null;

            return (
              <AccordionItem key={type} value={type}>
                <AccordionTrigger className="text-left">
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center gap-3">
                      <Mail className="h-4 w-4 text-muted-foreground" />
                      <span>{defaultTemplate.name}</span>
                      {timingLabel && (
                        <span className={`text-xs px-2 py-0.5 rounded font-medium ${badgeStyle}`}>
                          {timingLabel}
                        </span>
                      )}
                      {isCustomized && (
                        <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded">
                          Personnalisé
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground font-normal ml-7">{defaultTemplate.sendingInfo}</p>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="space-y-4 pt-4">
                  {renderTemplateEditor(type, defaultTemplate, currentMode, saveKey)}
                </AccordionContent>
              </AccordionItem>
            );
          })}
      </Accordion>
    </div>
  );

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Personnalisation des emails</CardTitle>
          <CardDescription>
            Modifiez le contenu des emails automatiques envoyés par l'application.
            Utilisez les variables entre doubles accolades (ex: {"{{first_name}}"}) pour insérer des données dynamiques.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {renderTimingSection("before", "\u{1F4C5} Avant la formation", "bg-secondary text-secondary-foreground", true, "J-")}
          <Separator />
          {renderTimingSection("after", "\u2705 Après la formation", "bg-accent text-accent-foreground", true, "J+")}
          <Separator />
          {renderTimingSection("during", "\u{1F3AF} Pendant la formation", "bg-secondary text-secondary-foreground", false, "")}
          <Separator />
          {renderTimingSection("manual", "\u270B Envoi manuel", "bg-secondary text-secondary-foreground", false, "")}
          <Separator />
          {renderTimingSection("mission_after", "\u{1F4BC} Après une mission", "bg-accent text-accent-foreground", true, "J+")}
        </CardContent>
      </Card>

      {/* Post-evaluation email configuration */}
      <PostEvaluationEmailManager />
    </>
  );
};

export default SettingsEmails;
