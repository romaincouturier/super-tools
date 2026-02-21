import { useState, useEffect } from "react";
import { Loader2, Save, RotateCcw, Sparkles, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { useToast } from "@/hooks/use-toast";
import {
  type EmailTemplate,
  type AddressMode,
  fetchEmailTemplates,
  updateEmailTemplate,
  createEmailTemplate,
  improveEmailWithAI,
} from "@/data/email-templates";
import { DEFAULT_TEMPLATES, type TemplateConfig } from "./emailTemplateDefaults";
import type { SettingsMap } from "@/data/settings";
import { DEFAULT_DELAYS } from "@/lib/constants";

interface EmailTemplatesSettingsProps {
  settings: SettingsMap;
}

const EmailTemplatesSettings = ({ settings }: EmailTemplatesSettingsProps) => {
  const { toast } = useToast();
  const [saving, setSaving] = useState<string | null>(null);
  const [improving, setImproving] = useState<string | null>(null);
  const [templates, setTemplates] = useState<Record<string, Record<AddressMode, EmailTemplate | null>>>({});
  const [editedTemplates, setEditedTemplates] = useState<Record<string, Record<AddressMode, { subject: string; content: string }>>>({});
  const [activeMode, setActiveMode] = useState<Record<string, AddressMode>>({});

  useEffect(() => {
    loadTemplates();
  }, []);

  const loadTemplates = async () => {
    try {
      const data = await fetchEmailTemplates();

      const templatesMap: Record<string, Record<AddressMode, EmailTemplate | null>> = {};
      const editedMap: Record<string, Record<AddressMode, { subject: string; content: string }>> = {};
      const modeMap: Record<string, AddressMode> = {};

      data.forEach((t) => {
        const isVous = t.template_type.endsWith("_vous");
        const isTu = t.template_type.endsWith("_tu");
        const mode: AddressMode = isVous ? "vous" : isTu ? "tu" : "vous";
        const baseType = isVous ? t.template_type.replace("_vous", "") : isTu ? t.template_type.replace("_tu", "") : t.template_type;

        if (!templatesMap[baseType]) templatesMap[baseType] = { tu: null, vous: null };
        if (!editedMap[baseType]) editedMap[baseType] = { tu: { subject: "", content: "" }, vous: { subject: "", content: "" } };

        templatesMap[baseType][mode] = t;
        editedMap[baseType][mode] = { subject: t.subject, content: t.html_content };
      });

      Object.keys(DEFAULT_TEMPLATES).forEach((type) => {
        if (!templatesMap[type]) templatesMap[type] = { tu: null, vous: null };
        if (!editedMap[type]) {
          editedMap[type] = {
            tu: { subject: DEFAULT_TEMPLATES[type].subject.tu, content: DEFAULT_TEMPLATES[type].content.tu },
            vous: { subject: DEFAULT_TEMPLATES[type].subject.vous, content: DEFAULT_TEMPLATES[type].content.vous },
          };
        } else {
          if (!editedMap[type].tu.subject) {
            editedMap[type].tu = { subject: DEFAULT_TEMPLATES[type].subject.tu, content: DEFAULT_TEMPLATES[type].content.tu };
          }
          if (!editedMap[type].vous.subject) {
            editedMap[type].vous = { subject: DEFAULT_TEMPLATES[type].subject.vous, content: DEFAULT_TEMPLATES[type].content.vous };
          }
        }
        modeMap[type] = "vous";
      });

      setTemplates(templatesMap);
      setEditedTemplates(editedMap);
      setActiveMode(modeMap);
    } catch (error) {
      console.error("Error fetching templates:", error);
    }
  };

  const handleSaveTemplate = async (templateType: string, mode: AddressMode) => {
    const saveKey = `${templateType}_${mode}`;
    setSaving(saveKey);
    try {
      const edited = editedTemplates[templateType]?.[mode];
      const existing = templates[templateType]?.[mode];

      if (existing) {
        await updateEmailTemplate(existing.id, { subject: edited.subject, content: edited.content });
      } else {
        const templateTypeWithMode = `${templateType}_${mode}`;
        const data = await createEmailTemplate({
          templateType: templateTypeWithMode,
          templateName: `${DEFAULT_TEMPLATES[templateType].name} (${mode === "tu" ? "tutoiement" : "vouvoiement"})`,
          subject: edited.subject,
          content: edited.content,
        });

        setTemplates((prev) => ({
          ...prev,
          [templateType]: { ...prev[templateType], [mode]: data },
        }));
      }

      toast({ title: "Template enregistré", description: `Le modèle d'email (${mode === "tu" ? "tutoiement" : "vouvoiement"}) a été mis à jour avec succès.` });
    } catch (error: unknown) {
      console.error("Save error:", error);
      toast({ title: "Erreur", description: "Impossible d'enregistrer le template.", variant: "destructive" });
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
        [mode]: { subject: defaultTemplate.subject[mode], content: defaultTemplate.content[mode] },
      },
    }));
    toast({ title: "Template réinitialisé", description: "Les valeurs par défaut ont été restaurées. N'oubliez pas d'enregistrer." });
  };

  const handleImproveWithAI = async (templateType: string, mode: AddressMode) => {
    const improveKey = `${templateType}_${mode}`;
    setImproving(improveKey);
    try {
      const edited = editedTemplates[templateType]?.[mode];
      const result = await improveEmailWithAI({
        subject: edited.subject,
        content: edited.content,
        templateType,
        templateName: DEFAULT_TEMPLATES[templateType].name,
      });

      setEditedTemplates((prev) => ({
        ...prev,
        [templateType]: {
          ...prev[templateType],
          [mode]: { subject: result.subject, content: result.content },
        },
      }));

      toast({ title: "Contenu amélioré", description: "L'IA a proposé des améliorations. Vérifiez et enregistrez si satisfait." });
    } catch (error: unknown) {
      console.error("AI improvement error:", error);
      toast({ title: "Erreur", description: error instanceof Error ? error.message : "Impossible d'améliorer le contenu avec l'IA.", variant: "destructive" });
    } finally {
      setImproving(null);
    }
  };

  const updateTemplateField = (templateType: string, mode: AddressMode, field: "subject" | "content", value: string) => {
    setEditedTemplates((prev) => ({
      ...prev,
      [templateType]: {
        ...prev[templateType],
        [mode]: { ...prev[templateType]?.[mode], [field]: value },
      },
    }));
  };

  const getDelayValue = (delayKey?: string): string | null => {
    if (!delayKey) return null;
    return (settings[delayKey as keyof SettingsMap]) || (DEFAULT_DELAYS as Record<string, string>)[delayKey] || null;
  };

  const renderTemplateEditor = (type: string, defaultTemplate: TemplateConfig, currentMode: AddressMode, saveKey: string) => (
    <>
      <div className="flex items-center gap-2 mb-4">
        <span className="text-sm text-muted-foreground">Version :</span>
        <Tabs value={currentMode} onValueChange={(v) => setActiveMode((prev) => ({ ...prev, [type]: v as AddressMode }))}>
          <TabsList className="h-8">
            <TabsTrigger value="tu" className="text-xs px-3 h-7">Tutoiement</TabsTrigger>
            <TabsTrigger value="vous" className="text-xs px-3 h-7">Vouvoiement</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      <div className="space-y-2">
        <Label>Objet de l'email</Label>
        <Input value={editedTemplates[type]?.[currentMode]?.subject || ""} onChange={(e) => updateTemplateField(type, currentMode, "subject", e.target.value)} placeholder="Objet du mail..." />
      </div>

      <div className="space-y-2">
        <Label>Contenu de l'email</Label>
        <Textarea value={editedTemplates[type]?.[currentMode]?.content || ""} onChange={(e) => updateTemplateField(type, currentMode, "content", e.target.value)} placeholder="Contenu du mail..." className="min-h-[200px] font-mono text-sm" />
      </div>

      <div className="space-y-2">
        <Label className="text-muted-foreground">Variables disponibles</Label>
        <div className="flex flex-wrap gap-2">
          {defaultTemplate.variables.map((variable) => (
            <code key={variable} className="px-2 py-1 bg-muted rounded text-xs">{`{{${variable}}}`}</code>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap gap-2 pt-2">
        <Button onClick={() => handleSaveTemplate(type, currentMode)} disabled={saving === saveKey || improving === saveKey}>
          {saving === saveKey ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
          Enregistrer
        </Button>
        <Button variant="secondary" onClick={() => handleImproveWithAI(type, currentMode)} disabled={improving === saveKey || saving === saveKey}>
          {improving === saveKey ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Sparkles className="h-4 w-4 mr-2" />}
          Améliorer avec l'IA
        </Button>
        <Button variant="outline" onClick={() => handleResetTemplate(type, currentMode)} disabled={saving === saveKey || improving === saveKey}>
          <RotateCcw className="h-4 w-4 mr-2" />
          Réinitialiser
        </Button>
      </div>
    </>
  );

  const renderTemplateGroup = (timing: string, label: string, delayPrefix: "J-" | "J+" | null) => {
    const filteredTemplates = Object.entries(DEFAULT_TEMPLATES).filter(([, t]) => t.timing === timing);
    if (filteredTemplates.length === 0) return null;

    return (
      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">{label}</h3>
        <Accordion type="single" collapsible className="w-full">
          {filteredTemplates.map(([type, defaultTemplate]) => {
            const currentMode = activeMode[type] || "vous";
            const saveKey = `${type}_${currentMode}`;
            const isCustomized = templates[type]?.tu || templates[type]?.vous;
            const delayValue = getDelayValue(defaultTemplate.delayKey);
            const timingLabel = delayPrefix && delayValue ? `${delayPrefix}${delayValue}` : null;

            return (
              <AccordionItem key={type} value={type}>
                <AccordionTrigger className="text-left">
                  <div className="flex items-center gap-3">
                    <Mail className="h-4 w-4 text-muted-foreground" />
                    <span>{defaultTemplate.name}</span>
                    {timingLabel && (
                      <span className={`text-xs px-2 py-0.5 rounded font-medium ${timing === "before" ? "bg-secondary text-secondary-foreground" : "bg-accent text-accent-foreground"}`}>
                        {timingLabel}
                      </span>
                    )}
                    {isCustomized && (
                      <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded">Personnalisé</span>
                    )}
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
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Personnalisation des emails</CardTitle>
        <CardDescription>
          Modifiez le contenu des emails automatiques envoyés par l'application.
          Utilisez les variables entre doubles accolades (ex: {"{{first_name}}"}) pour insérer des données dynamiques.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {renderTemplateGroup("before", "📅 Avant la formation", "J-")}
        <Separator />
        {renderTemplateGroup("after", "✅ Après la formation", "J+")}
        <Separator />
        {renderTemplateGroup("during", "🎯 Pendant la formation", null)}
        <Separator />
        {renderTemplateGroup("manual", "✋ Envoi manuel", null)}
      </CardContent>
    </Card>
  );
};

export default EmailTemplatesSettings;
