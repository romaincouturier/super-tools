import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, Sparkles, RefreshCw } from "lucide-react";
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

      // Build context for AI
      const context = [
        `Opportunité : ${crmCard.title}`,
        `Client : ${clientCompany}`,
        crmCard.description_html
          ? `Description : ${crmCard.description_html.replace(/<[^>]+>/g, "")}`
          : "",
        crmCard.service_type
          ? `Type de service : ${crmCard.service_type}`
          : "",
        crmCard.estimated_value
          ? `Valeur estimée : ${crmCard.estimated_value} €`
          : "",
        comments.length > 0
          ? `\nNotes et commentaires :\n${comments
              .map((c: any) => `- ${c.content}`)
              .join("\n")}`
          : "",
        emails.length > 0
          ? `\nÉchanges email :\n${emails
              .map(
                (e: any) =>
                  `- Objet: ${e.subject}\n  ${e.body_html?.replace(/<[^>]+>/g, "").substring(0, 300)}`
              )
              .join("\n")}`
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

              <Textarea
                value={synthesis}
                onChange={(e) => setSynthesis(e.target.value)}
                rows={14}
                className="font-mono text-sm"
                placeholder="La synthèse sera générée automatiquement..."
              />

              <Button
                variant="outline"
                onClick={generateSynthesis}
                disabled={isGenerating}
                className="gap-2"
              >
                <RefreshCw className="w-4 h-4" />
                Régénérer la synthèse
              </Button>
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
