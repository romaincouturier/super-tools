import { RotateCcw, Sparkles } from "lucide-react";
import { Spinner } from "@/components/ui/spinner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AutoSaveIndicator } from "@/components/settings/SettingsAutoSaveIndicator";
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
}: EmailTemplateEditorProps) => (
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

    <div className="space-y-2">
      <Label className="text-muted-foreground">Variables disponibles</Label>
      <div className="flex flex-wrap gap-2">
        {defaultTemplate.variables.map((variable) => (
          <code key={variable} className="px-2 py-1 bg-muted rounded text-xs">{`{{${variable}}}`}</code>
        ))}
      </div>
    </div>

    <div className="flex flex-wrap gap-2 pt-2 items-center">
      <AutoSaveIndicator status={templateAutoSaveStatus} />
      <Button variant="secondary" onClick={() => onImproveWithAI(type, currentMode)} disabled={improving === saveKey || saving === saveKey}>
        {improving === saveKey ? <Spinner className="mr-2" /> : <Sparkles className="h-4 w-4 mr-2" />}
        Améliorer avec l'IA
      </Button>
      <Button variant="outline" onClick={() => onResetTemplate(type, currentMode)} disabled={saving === saveKey || improving === saveKey}>
        <RotateCcw className="h-4 w-4 mr-2" />
        Réinitialiser
      </Button>
    </div>
  </>
);

export default EmailTemplateEditor;
