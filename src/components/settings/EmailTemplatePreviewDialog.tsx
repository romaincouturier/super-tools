import { useEffect, useMemo, useState } from "react";
import { RotateCcw } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  extractVariables,
  looksLikeHtml,
  processTemplate,
  sampleValue,
  textToHtml,
} from "@/lib/emailTemplatePreview";

interface EmailTemplatePreviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  templateName: string;
  subject: string;
  content: string;
  /** Variables declared for this template (merged with those found in the text). */
  declaredVariables?: string[];
}

const EmailTemplatePreviewDialog = ({
  open,
  onOpenChange,
  templateName,
  subject,
  content,
  declaredVariables = [],
}: EmailTemplatePreviewDialogProps) => {
  const variables = useMemo(() => {
    const used = extractVariables(subject, content);
    return [...new Set([...declaredVariables, ...used])].sort();
  }, [subject, content, declaredVariables]);

  const defaults = useMemo(() => {
    const map: Record<string, string> = {};
    variables.forEach((v) => { map[v] = sampleValue(v); });
    return map;
  }, [variables]);

  const [values, setValues] = useState<Record<string, string>>(defaults);

  useEffect(() => { if (open) setValues(defaults); }, [open, defaults]);

  const renderedSubject = processTemplate(subject, values, false);
  const renderedHtml = looksLikeHtml(content)
    ? processTemplate(content, values, true)
    : textToHtml(processTemplate(content, values, false));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-full sm:max-w-4xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Prévisualisation : {templateName}</DialogTitle>
          <DialogDescription>
            Modifiez les valeurs des variables pour voir le rendu du mail. Rien n'est enregistré ni envoyé.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-6 md:grid-cols-[280px_1fr] overflow-hidden flex-1">
          <div className="flex flex-col min-h-0">
            <div className="flex items-center justify-between mb-2">
              <Label className="text-xs uppercase tracking-wide text-muted-foreground">Variables</Label>
              <Button variant="ghost" size="sm" className="h-7 px-2" onClick={() => setValues(defaults)}>
                <RotateCcw className="h-3.5 w-3.5 mr-1" />
                Exemples
              </Button>
            </div>
            <ScrollArea className="flex-1 pr-3">
              {variables.length === 0 ? (
                <p className="text-sm text-muted-foreground">Ce modèle ne contient aucune variable.</p>
              ) : (
                <div className="space-y-3">
                  {variables.map((v) => (
                    <div key={v} className="space-y-1">
                      <Label className="text-xs font-mono">{`{{${v}}}`}</Label>
                      <Input
                        value={values[v] ?? ""}
                        onChange={(e) => setValues((prev) => ({ ...prev, [v]: e.target.value }))}
                        placeholder="(vide)"
                      />
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </div>

          <div className="flex flex-col min-h-0">
            <Label className="text-xs uppercase tracking-wide text-muted-foreground mb-2">Aperçu</Label>
            <div className="rounded-lg border overflow-hidden flex flex-col min-h-0">
              <div className="px-4 py-3 border-b bg-muted/40">
                <p className="text-xs text-muted-foreground">Objet</p>
                <p className="text-sm font-medium break-words">{renderedSubject || "(objet vide)"}</p>
              </div>
              <ScrollArea className="flex-1">
                <div
                  className="p-4 text-sm leading-relaxed [&_p]:mb-3 [&_a]:underline [&_a]:text-primary"
                  dangerouslySetInnerHTML={{ __html: renderedHtml }}
                />
              </ScrollArea>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              La signature et l'en-tête d'expédition sont ajoutés automatiquement à l'envoi.
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default EmailTemplatePreviewDialog;
