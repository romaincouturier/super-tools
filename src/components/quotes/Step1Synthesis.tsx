import { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, Sparkles, RefreshCw, Pencil, Eye } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { CrmCard } from "@/types/crm";

interface Props {
  crmCard: CrmCard;
  clientCompany: string;
  onValidate: (synthesis: string) => void;
  initialSynthesis?: string;
}

export default function Step1Synthesis({
  crmCard,
  clientCompany,
  onValidate,
  initialSynthesis,
}: Props) {
  const [synthesis, setSynthesis] = useState(initialSynthesis || "");
  const [isGenerating, setIsGenerating] = useState(false);
  const [generated, setGenerated] = useState(!!initialSynthesis);
  const [isEditing, setIsEditing] = useState(false);

  const generateSynthesis = async () => {
    setIsGenerating(true);
    try {
      // Fetch card comments and emails for context
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

      // Build rich context for AI — include FULL emails and description
      const descriptionText = crmCard.description_html
        ? crmCard.description_html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim()
        : "";

      const context = [
        `# Opportunité : ${crmCard.title}`,
        `Client : ${clientCompany}`,
        crmCard.service_type ? `Type de service : ${crmCard.service_type}` : "",
        crmCard.estimated_value ? `Valeur estimée : ${crmCard.estimated_value} €` : "",
        descriptionText ? `\n## Description complète de l'opportunité\n${descriptionText}` : "",
        comments.length > 0
          ? `\n## Notes et commentaires internes (${comments.length})\n${comments
              .map((c: any) => `[${c.created_at?.substring(0, 10) || ""}] ${c.content}`)
              .join("\n\n")}`
          : "",
        emails.length > 0
          ? `\n## Historique complet des échanges email (${emails.length} emails)\n${emails
              .map((e: any) => {
                const bodyText = e.body_html
                  ? e.body_html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim()
                  : "";
                return `### Email du ${e.sent_at?.substring(0, 10) || "date inconnue"}\nObjet : ${e.subject}\n\n${bodyText.substring(0, 2000)}`;
              })
              .join("\n\n---\n\n")}`
          : "",
      ]
        .filter(Boolean)
        .join("\n");

      const { data, error } = await supabase.functions.invoke(
        "generate-quote-synthesis",
        { body: { context } }
      );

      if (error) throw error;
      setSynthesis(data.synthesis || "");
      setGenerated(true);
    } catch (e: any) {
      console.error("Synthesis generation error:", e);
      // Provide a default template if AI fails
      setSynthesis(
        `## Contexte client\n${clientCompany}\n\n## Besoins identifiés\n${crmCard.title}\n\n## Périmètre pressenti\nÀ compléter\n\n## Points d'attention\nÀ compléter`
      );
      setGenerated(true);
    } finally {
      setIsGenerating(false);
    }
  };

  useEffect(() => {
    if (!initialSynthesis && !generated) {
      generateSynthesis();
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="w-5 h-5" />
            Synthèse automatique de l'opportunité
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
                  className="prose prose-sm max-w-none p-4 border rounded-md bg-muted/30 min-h-[200px] overflow-y-auto max-h-[500px]"
                  dangerouslySetInnerHTML={{ __html: synthesisHtml }}
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

      <div className="flex justify-end">
        <Button
          onClick={() => onValidate(synthesis)}
          disabled={!synthesis.trim() || isGenerating}
          size="lg"
        >
          Valider la synthèse et continuer
        </Button>
      </div>
    </div>
  );
}
