import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Video, ExternalLink, SkipForward, FileText, Loader2, Copy, RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
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

      const { data, error } = await supabase.functions.invoke("crm-ai-assist", {
        body: {
          action: "generate_loom_script",
          card_data: {
            company,
            description,
            synthesis: synthesis || "",
            instructions: instructions || "",
            challenge,
            service_type: crmCard.service_type || "",
            line_items: quote?.line_items || [],
          },
        },
      });
      if (error) throw error;
      setScript(data.result);
    } catch {
      setScript("Erreur lors de la génération du script. Veuillez réessayer.");
    } finally {
      setScriptLoading(false);
    }
  }, [crmCard, quote, synthesis, instructions, challengeHtml]);

  const copyScript = async () => {
    if (script) await navigator.clipboard.writeText(script);
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
                <div className="p-4 rounded-lg border bg-muted/30 text-sm whitespace-pre-wrap leading-relaxed">
                  {script}
                </div>
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
          Continuer vers la synthèse
        </Button>
      </div>
    </div>
  );
}
