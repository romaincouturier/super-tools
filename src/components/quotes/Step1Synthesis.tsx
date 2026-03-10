import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, Sparkles, RefreshCw, Pencil, Eye, Copy, Check, Mic, MicOff, FileText } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useVoiceDictation } from "@/hooks/useVoiceDictation";
import type { CrmCard } from "@/types/crm";

interface Props {
  crmCard: CrmCard;
  clientCompany: string;
  onValidate: (synthesis: string, instructions: string) => void;
  initialSynthesis?: string;
  initialInstructions?: string;
}

function htmlToPlainText(html: string): string {
  const div = document.createElement("div");
  div.innerHTML = html;
  return div.textContent || div.innerText || "";
}

function cleanHtmlOutput(raw: string): string {
  return raw
    .replace(/^```html?\s*\n?/i, "")
    .replace(/\n?```\s*$/i, "")
    .trim();
}

export default function Step1Synthesis({
  crmCard,
  clientCompany,
  onValidate,
  initialSynthesis,
  initialInstructions,
}: Props) {
  const [synthesis, setSynthesis] = useState(initialSynthesis || "");
  const [instructions, setInstructions] = useState(initialInstructions || "");
  const [isGenerating, setIsGenerating] = useState(false);
  const [generated, setGenerated] = useState(!!initialSynthesis);
  const [isEditing, setIsEditing] = useState(false);
  const [copied, setCopied] = useState(false);

  const { isRecording, isTranscribing, isSupported, startRecording, stopRecording } =
    useVoiceDictation({
      onTranscript: (text) => {
        setInstructions((prev) => (prev ? prev + "\n" + text : text));
      },
    });

  const handleToggleMic = () => {
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  };

  const generateSynthesis = async () => {
    setIsGenerating(true);
    try {
      const [commentsRes, emailsRes] = await Promise.all([
        (supabase as any)
          .from("crm_comments")
          .select("content, created_at")
          .eq("card_id", crmCard.id)
          .eq("is_deleted", false)
          .order("created_at", { ascending: true }),
        (supabase as any)
          .from("crm_card_emails")
          .select("subject, body_html, sent_at")
          .eq("card_id", crmCard.id)
          .order("sent_at", { ascending: true }),
      ]);

      const comments = commentsRes.data || [];
      const emails = emailsRes.data || [];

      const descriptionText = crmCard.description_html
        ? crmCard.description_html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim()
        : "";

      const context = [
        `Opportunité : ${crmCard.title}`,
        `Client : ${clientCompany}`,
        crmCard.service_type ? `Type de service : ${crmCard.service_type}` : "",
        crmCard.estimated_value ? `Valeur estimée : ${crmCard.estimated_value} €` : "",
        descriptionText ? `\nDescription complète :\n${descriptionText}` : "",
        comments.length > 0
          ? `\nNotes internes (${comments.length}) :\n${comments
              .map((c: any) => `[${c.created_at?.substring(0, 10) || ""}] ${c.content}`)
              .join("\n")}`
          : "",
        emails.length > 0
          ? `\nHistorique email (${emails.length}) :\n${emails
              .map((e: any) => {
                const bodyText = e.body_html
                  ? e.body_html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim()
                  : "";
                return `--- Email du ${e.sent_at?.substring(0, 10) || "?"} ---\nObjet : ${e.subject}\n${bodyText.substring(0, 2000)}`;
              })
              .join("\n\n")}`
          : "",
      ]
        .filter(Boolean)
        .join("\n");

      const { data, error } = await supabase.functions.invoke(
        "generate-quote-synthesis",
        { body: { context } }
      );

      if (error) throw error;
      const cleaned = cleanHtmlOutput(data.synthesis || "");
      setSynthesis(cleaned);
      setGenerated(true);
    } catch (e: any) {
      console.error("Synthesis generation error:", e);
      setSynthesis(
        `<h3>Contexte client</h3><p>${clientCompany}</p><h3>Besoins identifiés</h3><p>${crmCard.title}</p><h3>Périmètre pressenti</h3><p>À compléter</p><h3>Points d'attention</h3><p>À compléter</p>`
      );
      setGenerated(true);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCopy = async () => {
    const text = htmlToPlainText(synthesis);
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  useEffect(() => {
    if (!initialSynthesis && !generated) {
      generateSynthesis();
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="space-y-6">
      {/* Synthesis card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span className="flex items-center gap-2">
              <Sparkles className="w-5 h-5" />
              Synthèse automatique de l'opportunité
            </span>
            {synthesis && !isGenerating && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleCopy}
                className="gap-1.5 text-muted-foreground hover:text-foreground"
              >
                {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                {copied ? "Copié" : "Copier"}
              </Button>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {isGenerating ? (
            <div className="flex items-center justify-center py-12 gap-3">
              <Loader2 className="w-5 h-5 animate-spin text-primary" />
              <span className="text-muted-foreground">
                Analyse de l'opportunité en cours...
              </span>
            </div>
          ) : (
            <>
              <Alert>
                <Sparkles className="w-4 h-4" />
                <AlertDescription>
                  Relisez et modifiez cette synthèse. Elle servira de base pour
                  la génération du devis.
                </AlertDescription>
              </Alert>

              {isEditing ? (
                <Textarea
                  value={synthesis}
                  onChange={(e) => setSynthesis(e.target.value)}
                  rows={18}
                  className="font-mono text-sm"
                  placeholder="La synthèse sera générée automatiquement..."
                />
              ) : (
                <div
                  className="synthesis-content p-4 border rounded-md bg-muted/30 overflow-y-auto max-h-[500px] text-sm leading-relaxed [&_h3]:text-base [&_h3]:font-semibold [&_h3]:mt-4 [&_h3]:mb-1 [&_h3:first-child]:mt-0 [&_p]:my-1 [&_ul]:my-1 [&_ul]:pl-5 [&_ul]:list-disc [&_li]:my-0.5 [&_strong]:font-semibold"
                  dangerouslySetInnerHTML={{ __html: synthesis }}
                />
              )}

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsEditing(!isEditing)}
                  className="gap-2"
                >
                  {isEditing ? <Eye className="w-4 h-4" /> : <Pencil className="w-4 h-4" />}
                  {isEditing ? "Aperçu" : "Modifier"}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={generateSynthesis}
                  disabled={isGenerating}
                  className="gap-2"
                >
                  <RefreshCw className="w-4 h-4" />
                  Régénérer
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Instructions card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5" />
            Instructions complémentaires pour le devis
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert>
            <FileText className="w-4 h-4" />
            <AlertDescription>
              Précisez les prestations, durées, tarifs et conditions
              particulières. Vous pouvez dicter ou saisir au clavier.
            </AlertDescription>
          </Alert>

          <div className="relative">
            <Textarea
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
              rows={8}
              placeholder="Ex: Formation React avancé, 3 jours, 1500€ HT/jour, 6 participants max..."
              className="pr-14"
            />
            {isSupported && (
              <Button
                type="button"
                variant={isRecording ? "destructive" : "outline"}
                size="icon"
                className="absolute top-3 right-3"
                onClick={handleToggleMic}
                disabled={isTranscribing}
                title={isRecording ? "Arrêter la dictée" : "Dicter les instructions"}
              >
                {isTranscribing ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : isRecording ? (
                  <MicOff className="w-4 h-4" />
                ) : (
                  <Mic className="w-4 h-4" />
                )}
              </Button>
            )}
          </div>

          {isRecording && (
            <div className="flex items-center gap-2 text-sm text-destructive animate-pulse">
              <div className="w-2 h-2 bg-destructive rounded-full" />
              Enregistrement en cours... Parlez puis cliquez pour arrêter.
            </div>
          )}

          {isTranscribing && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="w-3 h-3 animate-spin" />
              Transcription en cours...
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button
          onClick={() => onValidate(synthesis, instructions)}
          disabled={!synthesis.trim() || isGenerating}
          size="lg"
        >
          Continuer vers la génération
        </Button>
      </div>
    </div>
  );
}
