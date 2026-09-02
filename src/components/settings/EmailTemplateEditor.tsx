import { useState } from "react";
import { Eye, RotateCcw, Sparkles } from "lucide-react";
import EmailTemplatePreviewDialog from "@/components/settings/EmailTemplatePreviewDialog";
import { Spinner } from "@/components/ui/spinner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AutoSaveIndicator } from "@/components/settings/SettingsAutoSaveIndicator";
import { extractVariables } from "@/lib/emailTemplatePreview";
import { getVariableDoc, TEMPLATE_SYNTAX_HELP } from "@/lib/emailVariableDocs";
import type { AddressMode, TemplateConfig } from "@/components/settings/settingsConstants";


interface EmailTemplateEditorProps {
  type: string;
  defaultTemplate: TemplateConfig;
  currentMode: AddressMode;
  saveKey: string;
  editedSubject: string;
  editedContent: string;
  templateAutoSaveStatus: "idle" | "saving" | "saved";
  improving: string | null;
  saving: string | null;
  onModeChange: (type: string, mode: AddressMode) => void;
  onUpdateTemplate: (type: string, mode: AddressMode, field: "subject" | "content", value: string) => void;
  onImproveWithAI: (type: string, mode: AddressMode) => void;
  onResetTemplate: (type: string, mode: AddressMode) => void;
}

const EmailTemplateEditor = ({
  type,
  defaultTemplate,
  currentMode,
  saveKey,
  editedSubject,
  editedContent,
  templateAutoSaveStatus,
  improving,
  saving,
  onModeChange,
  onUpdateTemplate,
  onImproveWithAI,
  onResetTemplate,
}: EmailTemplateEditorProps) => {
  const [previewOpen, setPreviewOpen] = useState(false);
  const documentedVariables = [...new Set([
    ...defaultTemplate.variables,
    ...extractVariables(editedSubject, editedContent),
  ])].sort();

  return (
  <>
    <div className="flex items-center gap-2 mb-4">
      <span className="text-sm text-muted-foreground">Version :</span>
      <Tabs value={currentMode} onValueChange={(v) => onModeChange(type, v as AddressMode)}>
        <TabsList className="h-8">
          <TabsTrigger value="tu" className="text-xs px-3 h-7">Tutoiement</TabsTrigger>
          <TabsTrigger value="vous" className="text-xs px-3 h-7">Vouvoiement</TabsTrigger>
        </TabsList>
      </Tabs>
    </div>

    <div className="space-y-2">
      <Label>Objet de l'email</Label>
      <Input value={editedSubject} onChange={(e) => onUpdateTemplate(type, currentMode, "subject", e.target.value)} placeholder="Objet du mail..." />
    </div>

    <div className="space-y-2">
      <Label>Contenu de l'email</Label>
      <Textarea value={editedContent} onChange={(e) => onUpdateTemplate(type, currentMode, "content", e.target.value)} placeholder="Contenu du mail..." className="min-h-[200px] font-mono text-sm" />
    </div>

    <div className="space-y-3">
      <div>
        <Label className="text-muted-foreground">Variables disponibles</Label>
        <p className="text-xs text-muted-foreground mt-1">
          Copiez le code entre accolades dans l'objet ou le contenu : il sera remplacé par la vraie valeur à l'envoi.
        </p>
      </div>
        <div className="grid gap-2 sm:grid-cols-2">
        {documentedVariables.map((variable) => {
          const doc = getVariableDoc(variable);
          return (
            <div key={variable} className="rounded-md border bg-muted/30 p-2">
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-xs font-medium">{doc.label}</span>
                <code className="px-1.5 py-0.5 bg-background border rounded text-[11px] whitespace-nowrap">
                  {doc.isCondition ? `{{#${variable}}}…{{/${variable}}}` : `{{${variable}}}`}
                </code>
              </div>
              <p className="text-[11px] text-muted-foreground mt-1">{doc.description}</p>
            </div>
          );
        })}
      </div>

      <details className="rounded-md border p-3">
        <summary className="text-sm font-medium cursor-pointer">Comment écrire le modèle ?</summary>
        <div className="mt-3 space-y-3">
          {TEMPLATE_SYNTAX_HELP.map((help) => (
            <div key={help.title} className="space-y-1">
              <p className="text-sm font-medium">{help.title}</p>
              <p className="text-xs text-muted-foreground">{help.detail}</p>
              <pre className="text-[11px] bg-muted rounded p-2 whitespace-pre-wrap">{help.example}</pre>
            </div>
          ))}
        </div>
      </details>
    </div>


    <div className="flex flex-wrap gap-2 pt-2 items-center">
      <AutoSaveIndicator status={templateAutoSaveStatus} />
      <Button variant="secondary" onClick={() => onImproveWithAI(type, currentMode)} disabled={improving === saveKey || saving === saveKey}>
        {improving === saveKey ? <Spinner className="mr-2" /> : <Sparkles className="h-4 w-4 mr-2" />}
        Améliorer avec l'IA
      </Button>
      <Button variant="outline" onClick={() => setPreviewOpen(true)}>
        <Eye className="h-4 w-4 mr-2" />
        Prévisualiser
      </Button>
      <Button variant="outline" onClick={() => onResetTemplate(type, currentMode)} disabled={saving === saveKey || improving === saveKey}>
        <RotateCcw className="h-4 w-4 mr-2" />
        Réinitialiser
      </Button>
    </div>

    <EmailTemplatePreviewDialog
      open={previewOpen}
      onOpenChange={setPreviewOpen}
      templateName={`${defaultTemplate.name} (${currentMode === "tu" ? "tutoiement" : "vouvoiement"})`}
      templateType={type}
      subject={editedSubject}
      content={editedContent}
       declaredVariables={documentedVariables}
     />
  </>
  );
};

export default EmailTemplateEditor;
