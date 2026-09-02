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
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Switch } from "@/components/ui/switch";
import {
  extractConditionalVariables,
  extractValueVariables,
  extractVariables,
  processTemplate,
  renderEmailDocument,
  rendererForTemplateType,
  RENDERER_LABELS,
  sampleValue,
} from "@/lib/emailTemplatePreview";
import { getVariableDoc, TEMPLATE_SYNTAX_HELP } from "@/lib/emailVariableDocs";

interface EmailTemplatePreviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  templateName: string;
  /** Template type key (drives which server-side renderer is mirrored). */
  templateType?: string;
  subject: string;
  content: string;
  /** Variables declared for this template (merged with those found in the text). */
  declaredVariables?: string[];
}

const EmailTemplatePreviewDialog = ({
  open,
  onOpenChange,
  templateName,
  templateType,
  subject,
  content,
  declaredVariables = [],
}: EmailTemplatePreviewDialogProps) => {
  const renderer = rendererForTemplateType(templateType);
  const variables = useMemo(() => {
    const used = extractVariables(subject, content);
    return [...new Set([...declaredVariables, ...used])].sort();
  }, [subject, content, declaredVariables]);

  const conditionalVariables = useMemo(
    () => new Set(extractConditionalVariables(subject, content)),
    [subject, content],
  );
  const valueVariables = useMemo(
    () => new Set(extractValueVariables(subject, content)),
    [subject, content],
  );

  const defaults = useMemo(() => {
    const map: Record<string, string> = {};
    variables.forEach((v) => { map[v] = sampleValue(v); });
    return map;
  }, [variables]);

  const [values, setValues] = useState<Record<string, string>>(defaults);

  useEffect(() => { if (open) setValues(defaults); }, [open, defaults]);

  const renderedSubject = processTemplate(subject, values, false);
  const emailDocument = useMemo(
    () => renderEmailDocument(content, values, renderer),
    [content, values, renderer],
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-full sm:max-w-5xl max-h-[92vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Prévisualisation : {templateName}</DialogTitle>
          <DialogDescription>
            Le rendu ci-dessous reprend exactement la mise en forme appliquée à l'envoi de ce modèle
            (police, largeur, paragraphes). {RENDERER_LABELS[renderer]}{" "}
            Modifiez les valeurs pour tester. Rien n'est enregistré ni envoyé.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-6 md:grid-cols-[320px_1fr] overflow-hidden flex-1">
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
                <div className="space-y-4">
                  {variables.map((v) => {
                    const doc = getVariableDoc(v);
                    const isCondition = conditionalVariables.has(v) || doc.isCondition;
                    const isValue = valueVariables.has(v);
                    const toggleOnly = isCondition && !isValue;
                    const filled = Boolean(values[v]);
                    return (
                      <div key={v} className="space-y-1">
                        <Label className="text-sm font-medium">{doc.label}</Label>
                        <p className="text-xs text-muted-foreground">{doc.description}</p>
                        <code className="inline-block text-[11px] px-1.5 py-0.5 bg-muted rounded">
                          {isCondition && !isValue
                            ? `{{#${v}}} ... {{/${v}}}`
                            : isCondition
                              ? `{{${v}}} + {{#${v}}} ... {{/${v}}}`
                              : `{{${v}}}`}
                        </code>
                        {toggleOnly ? (
                          <div className="flex items-center gap-2 pt-1">
                            <Switch
                              checked={filled}
                              onCheckedChange={(checked) =>
                                setValues((prev) => ({ ...prev, [v]: checked ? sampleValue(v) || "1" : "" }))
                              }
                            />
                            <span className="text-xs text-muted-foreground">
                              {filled ? "Bloc affiché" : "Bloc masqué"}
                            </span>
                          </div>
                        ) : doc.isBlock ? (
                          <Textarea
                            className="text-sm min-h-[70px]"
                            value={values[v] ?? ""}
                            onChange={(e) => setValues((prev) => ({ ...prev, [v]: e.target.value }))}
                            placeholder="(vide)"
                          />
                        ) : (
                          <Input
                            value={values[v] ?? ""}
                            onChange={(e) => setValues((prev) => ({ ...prev, [v]: e.target.value }))}
                            placeholder="(vide)"
                          />
                        )}
                        {isCondition && !toggleOnly && (
                          <p className="text-[11px] text-muted-foreground">
                            Laissez vide pour masquer le bloc conditionnel {`{{#${v}}}`}.
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              <div className="mt-6 border-t pt-4 space-y-3">
                <Label className="text-xs uppercase tracking-wide text-muted-foreground">
                  Comment écrire le modèle
                </Label>
                {TEMPLATE_SYNTAX_HELP.map((help) => (
                  <div key={help.title} className="space-y-1">
                    <p className="text-sm font-medium">{help.title}</p>
                    <p className="text-xs text-muted-foreground">{help.detail}</p>
                    <pre className="text-[11px] bg-muted rounded p-2 whitespace-pre-wrap">{help.example}</pre>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </div>

          <div className="flex flex-col min-h-0">
            <Label className="text-xs uppercase tracking-wide text-muted-foreground mb-2">Aperçu</Label>
            <div className="rounded-lg border overflow-hidden flex flex-col min-h-0 flex-1">
              <div className="px-4 py-3 border-b bg-muted/40">
                <p className="text-xs text-muted-foreground">Objet</p>
                <p className="text-sm font-medium break-words">{renderedSubject || "(objet vide)"}</p>
              </div>
              <iframe
                title="Aperçu de l'email"
                sandbox=""
                srcDoc={emailDocument}
                className="flex-1 w-full min-h-[420px] bg-white"
              />
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
