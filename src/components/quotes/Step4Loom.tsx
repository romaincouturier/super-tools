import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Video, ExternalLink, SkipForward, FileText, Loader2, Copy, RefreshCw } from "lucide-react";
import { crmAiAssist } from "@/services/crmAiAssist";
import type { CrmCard } from "@/types/crm";
import type { Quote } from "@/types/quotes";

interface Props {
  onContinue: (loomUrl: string | null) => void;
  onDraftChange?: (loomUrl: string) => void;
  initialLoomUrl?: string | null;
  crmCard?: CrmCard;
  quote?: Quote | null;
  synthesis?: string;
  instructions?: string;
  challengeHtml?: string;
}

function stripHtml(html: string): string {
  const div = document.createElement("div");
  div.innerHTML = html;
  return div.textContent || div.innerText || "";
}

function cleanScriptOutput(raw: string): string {
  // Strip markdown code fences
  let cleaned = raw
    .replace(/^```html?\s*\n?/i, "")
    .replace(/\n?```\s*$/i, "")
    .trim();

  // If the output looks like markdown (has # headers, **bold**, etc.) convert to basic HTML
  if (/^#{1,3}\s/m.test(cleaned) && !/<[a-z][\s\S]*>/i.test(cleaned)) {
    cleaned = cleaned
      .replace(/^### (.+)$/gm, "<h3>$1</h3>")
      .replace(/^## (.+)$/gm, "<h2>$1</h2>")
      .replace(/^# (.+)$/gm, "<h1>$1</h1>")
      .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
      .replace(/\*(.+?)\*/g, "<em>$1</em>")
      .replace(/^- (.+)$/gm, "<li>$1</li>")
      .replace(/(<li>[\s\S]*?<\/li>)/g, "<ul>$1</ul>")
      .replace(/<\/ul>\s*<ul>/g, "")
      .replace(/\n{2,}/g, "</p><p>")
      .replace(/^(?!<[a-z])/gm, (line) => line ? `<p>${line}</p>` : "")
      .replace(/<p><(h[1-3]|ul|li|ol)>/g, "<$1>")
      .replace(/<\/(h[1-3]|ul|li|ol)><\/p>/g, "</$1>");
  }

  return cleaned;
}

export default function Step4Loom({
  onContinue,
  onDraftChange,
  initialLoomUrl,
  crmCard,
  quote,
  synthesis,
  instructions,
  challengeHtml,
}: Props) {
  const [loomUrl, setLoomUrl] = useState(initialLoomUrl || "");
  const [script, setScript] = useState("");
  const [scriptLoading, setScriptLoading] = useState(false);

  // Auto-save draft
  useEffect(() => {
    if (onDraftChange && loomUrl.trim()) {
      const timeout = setTimeout(() => onDraftChange(loomUrl.trim()), 1500);
      return () => clearTimeout(timeout);
    }
  }, [loomUrl]); // eslint-disable-line react-hooks/exhaustive-deps

  const isValidLoomUrl =
    !loomUrl.trim() || /^https:\/\/(www\.)?loom\.com\/share\//.test(loomUrl.trim());

  const hasContext = !!(crmCard?.description_html || synthesis || instructions || challengeHtml);

  const generateScript = useCallback(async () => {
    if (!crmCard) return;
    setScriptLoading(true);
    setScript("");
    try {
      const description = crmCard.description_html ? stripHtml(crmCard.description_html) : "";
      const challenge = challengeHtml ? stripHtml(challengeHtml) : "";
      const company = quote?.client_company || crmCard.company || "";

      const result = await crmAiAssist("generate_loom_script", {
        company,
        description,
        synthesis: synthesis || "",
        instructions: instructions || "",
        challenge,
        service_type: crmCard.service_type || "",
        line_items: quote?.line_items || [],
      });
      setScript(cleanScriptOutput(result));
    } catch {
      setScript("Erreur lors de la génération du script. Veuillez réessayer.");
    } finally {
      setScriptLoading(false);
    }
  }, [crmCard, quote, synthesis, instructions, challengeHtml]);

  const copyScript = async () => {
    if (script) await navigator.clipboard.writeText(stripHtml(script));
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Video className="w-5 h-5" />
            Vidéo explicative Loom (optionnel)
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert>
            <Video className="w-4 h-4" />
            <AlertDescription>
              Souhaitez-vous enregistrer une vidéo explicative Loom ?
              Si oui, enregistrez votre vidéo puis collez le lien ci-dessous.
            </AlertDescription>
          </Alert>

          {/* Script template */}
          {hasContext && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="flex items-center gap-1.5 text-sm font-medium">
                  <FileText className="h-4 w-4" />
                  Trame de script
                </Label>
                <div className="flex gap-1">
                  {script && (
                    <>
                      <Button variant="ghost" size="sm" onClick={copyScript} title="Copier" className="h-7 px-2 gap-1 text-xs">
                        <Copy className="h-3 w-3" />
                        Copier
                      </Button>
                      <Button variant="ghost" size="sm" onClick={generateScript} title="Régénérer" className="h-7 px-2 gap-1 text-xs" disabled={scriptLoading}>
                        <RefreshCw className="h-3 w-3" />
                      </Button>
                    </>
                  )}
                </div>
              </div>
              {!script && !scriptLoading && (
                <Button variant="outline" size="sm" onClick={generateScript} className="gap-2">
                  <FileText className="h-4 w-4" />
                  Générer une trame de script
                </Button>
              )}
              {scriptLoading && (
                <div className="flex items-center gap-2 p-4 rounded-lg border bg-muted/30 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Génération de la trame en cours…
                </div>
              )}
              {script && !scriptLoading && (
                <div
                  className="p-4 rounded-lg border bg-muted/30 text-sm leading-relaxed [&_h1]:text-lg [&_h1]:font-bold [&_h1]:mt-4 [&_h1]:mb-2 [&_h2]:text-base [&_h2]:font-semibold [&_h2]:mt-3 [&_h2]:mb-1 [&_h3]:text-sm [&_h3]:font-semibold [&_h3]:mt-3 [&_h3]:mb-1 [&_p]:my-1.5 [&_ul]:my-1 [&_ul]:pl-5 [&_ul]:list-disc [&_ol]:my-1 [&_ol]:pl-5 [&_ol]:list-decimal [&_li]:my-0.5 [&_strong]:font-semibold"
                  dangerouslySetInnerHTML={{ __html: script }}
                />
              )}
            </div>
          )}

          <div className="flex gap-3">
            <Button variant="outline" asChild className="gap-2">
              <a
                href="https://www.loom.com/record"
                target="_blank"
                rel="noopener noreferrer"
              >
                <ExternalLink className="w-4 h-4" />
                Ouvrir Loom
              </a>
            </Button>
          </div>

          <div className="space-y-2">
            <Label>Lien de la vidéo Loom</Label>
            <Input
              value={loomUrl}
              onChange={(e) => setLoomUrl(e.target.value)}
              placeholder="https://www.loom.com/share/..."
            />
            {loomUrl && !isValidLoomUrl && (
              <p className="text-xs text-destructive">
                Le lien doit être au format https://www.loom.com/share/...
              </p>
            )}
          </div>

          {loomUrl && isValidLoomUrl && (
            <div className="border rounded-lg overflow-hidden">
              <div
                className="relative w-full"
                style={{ paddingBottom: "56.25%" }}
              >
                <iframe
                  src={loomUrl.replace("/share/", "/embed/")}
                  className="absolute inset-0 w-full h-full"
                  allowFullScreen
                  title="Loom video preview"
                />
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex justify-between">
        <Button
          variant="outline"
          onClick={() => onContinue(null)}
          className="gap-2"
        >
          <SkipForward className="w-4 h-4" />
          Passer cette étape
        </Button>
        <Button
          onClick={() => onContinue(loomUrl.trim() || null)}
          disabled={!!loomUrl.trim() && !isValidLoomUrl}
          size="lg"
        >
          Continuer vers les déplacements
        </Button>
      </div>
    </div>
  );
}
