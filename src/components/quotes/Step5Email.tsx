import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, Mail, Send, TestTube, Sparkles } from "lucide-react";
import { Spinner } from "@/components/ui/spinner";
import { supabase } from "@/integrations/supabase/client";
import { useUpdateQuote, useQuoteSettings } from "@/hooks/useQuotes";
import { toast } from "sonner";
import type { Quote } from "@/types/quotes";

interface Props {
  quote: Quote;
  synthesis: string;
  loomUrl: string | null;
  clientEmail: string;
  clientCompany: string;
  onSent: () => void;
}

export default function Step5Email({
  quote,
  synthesis,
  loomUrl,
  clientEmail,
  clientCompany,
  onSent,
}: Props) {
  const updateMutation = useUpdateQuote();
  const { data: settings } = useQuoteSettings();
  const [to, setTo] = useState(clientEmail);
  const [subject, setSubject] = useState(
    quote.email_subject || `Devis ${quote.quote_number} — ${clientCompany}`
  );
  const [body, setBody] = useState(quote.email_body || "");
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [isTestSending, setIsTestSending] = useState(false);

  const generateEmail = async () => {
    setIsGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke(
        "generate-quote-email",
        {
          body: {
            clientCompany,
            synthesis,
            loomUrl,
            quoteNumber: quote.quote_number,
          },
        }
      );
      if (error) throw error;
      if (data?.subject) setSubject(data.subject);
      if (data?.body) setBody(data.body);
    } catch (e: unknown) {
      console.error("Email generation error:", e);
      // Fallback template
      setBody(
        `Bonjour,\n\nSuite à nos échanges, veuillez trouver ci-joint notre proposition commerciale ${quote.quote_number}.\n\n${
          synthesis
            ? `Pour rappel, voici le contexte de notre discussion :\n${synthesis.substring(0, 300)}...\n\n`
            : ""
        }${
          loomUrl
            ? `J'ai également préparé une courte vidéo explicative que vous pouvez visionner ici : ${loomUrl}\n\n`
            : ""
        }Je reste à votre disposition pour toute question.\n\nCordialement`
      );
    } finally {
      setIsGenerating(false);
    }
  };

  useEffect(() => {
    if (!quote.email_body) {
      generateEmail();
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleTestSend = async () => {
    setIsTestSending(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user?.email) throw new Error("Impossible de récupérer votre email");

      await supabase.functions.invoke("send-quote-email", {
        body: {
          quoteId: quote.id,
          to: user.email,
          subject: `[TEST] ${subject}`,
          body,
          isTest: true,
        },
      });

      toast.success(`Email de test envoyé à ${user.email}`);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Erreur lors de l'envoi du test");
    } finally {
      setIsTestSending(false);
    }
  };

  const handleSend = async () => {
    if (!to.trim()) {
      toast.error("Veuillez renseigner l'adresse email du destinataire");
      return;
    }

    setIsSending(true);
    try {
      const sentAt = new Date().toISOString();

      // Send email via edge function FIRST. If Resend fails, the edge
      // function returns an error — the quote must stay in its prior
      // state and the opportunity must NOT move to "Devis envoyé".
      const { data: sendResult, error: sendError } = await supabase.functions.invoke(
        "send-quote-email",
        {
          body: {
            quoteId: quote.id,
            to,
            subject,
            body,
            isTest: false,
          },
        }
      );
      if (sendError || (sendResult && sendResult.error)) {
        throw new Error(
          sendError?.message ||
            sendResult?.error ||
            "Échec de l'envoi du devis par email"
        );
      }

      // Email sent successfully: now mark the quote as sent.
      // The DB trigger `quotes_recompute_estimated_value` will
      // refresh crm_cards.estimated_value to MIN across sent quotes.
      await updateMutation.mutateAsync({
        id: quote.id,
        updates: {
          email_subject: subject,
          email_body: body,
          email_sent_at: sentAt,
          status: "sent",
        },
      });

      // Log email in CRM card history (crm_card_emails)
      const senderEmail = settings?.company_email || "";
      const attachmentPaths = sendResult?.attachment_paths as string[] | undefined;
      await supabase.from("crm_card_emails").insert({
        card_id: quote.crm_card_id,
        sender_email: senderEmail,
        recipient_email: to,
        subject,
        body_html: body.replace(/\n/g, "<br>"),
        sent_at: sentAt,
        attachment_names: [`${quote.quote_number}.pdf`],
        attachment_paths: attachmentPaths?.length ? attachmentPaths : null,
        delivery_status: "sent",
      });

      // Log activity in CRM activity log
      const { data: { user } } = await supabase.auth.getUser();
      const actorEmail = user?.email || senderEmail;
      await supabase.from("crm_activity_log").insert({
        card_id: quote.crm_card_id,
        action_type: "email_sent",
        new_value: `Devis ${quote.quote_number} envoyé à ${to}`,
        actor_email: actorEmail,
      });

      // Auto-move CRM card to "Devis envoyé" column (same as MicroDevis)
      try {
        const { data: columns } = await supabase
          .from("crm_columns")
          .select("id, name")
          .ilike("name", "%devis envoy%")
          .limit(1);
        const devisColumn = columns?.[0];
        if (devisColumn) {
          const { data: card } = await supabase
            .from("crm_cards")
            .select("column_id")
            .eq("id", quote.crm_card_id)
            .single();
          if (card && card.column_id !== devisColumn.id) {
            const oldColumnId = card.column_id;
            await supabase
              .from("crm_cards")
              .update({ column_id: devisColumn.id })
              .eq("id", quote.crm_card_id);
            await supabase.from("crm_activity_log").insert({
              card_id: quote.crm_card_id,
              action_type: "card_moved",
              old_value: oldColumnId,
              new_value: devisColumn.id,
              actor_email: actorEmail,
            });
          }
        }

        // Set follow-up: WAITING + J+3 working days (same as MicroDevis)
        const followUpDate = new Date();
        let daysAdded = 0;
        while (daysAdded < 3) {
          followUpDate.setDate(followUpDate.getDate() + 1);
          const day = followUpDate.getDay();
          if (day !== 0 && day !== 6) daysAdded++;
        }
        await supabase
          .from("crm_cards")
          .update({
            status_operational: "WAITING",
            waiting_next_action_date: followUpDate.toISOString().split("T")[0],
            waiting_next_action_text: "Relancer le client suite à l'envoi du devis",
          })
          .eq("id", quote.crm_card_id);
      } catch (crmErr) {
        console.warn("CRM auto-update failed (non-blocking):", crmErr);
      }

      toast.success(`Devis envoyé à ${to}`);
      onSent();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Erreur lors de l'envoi");
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="w-5 h-5" />
            Préparation et envoi du mail
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {isGenerating ? (
            <div className="flex items-center justify-center py-12 gap-3">
              <Loader2 className="w-5 h-5 animate-spin text-primary" />
              <span className="text-muted-foreground">
                Génération du mail...
              </span>
            </div>
          ) : (
            <>
              <div className="space-y-2">
                <Label>Destinataire</Label>
                <Input
                  type="email"
                  value={to}
                  onChange={(e) => setTo(e.target.value)}
                  placeholder="email@client.com"
                />
              </div>

              <div className="space-y-2">
                <Label>Objet</Label>
                <Input
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label>Corps du mail</Label>
                <Textarea
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  rows={14}
                  className="font-mono text-sm"
                />
              </div>

              <Button
                variant="outline"
                onClick={generateEmail}
                disabled={isGenerating}
                className="gap-2"
              >
                <Sparkles className="w-4 h-4" />
                Régénérer le mail
              </Button>

              {loomUrl && (
                <Alert>
                  <AlertDescription>
                    Le lien Loom sera inclus dans le mail : {loomUrl}
                  </AlertDescription>
                </Alert>
              )}

              <Alert>
                <AlertDescription>
                  Le devis PDF ({quote.quote_number}) sera joint
                  automatiquement.
                </AlertDescription>
              </Alert>
            </>
          )}
        </CardContent>
      </Card>

      <div className="flex justify-between">
        <Button
          variant="outline"
          onClick={handleTestSend}
          disabled={isTestSending || isGenerating}
          className="gap-2"
        >
          {isTestSending ? (
            <Spinner />
          ) : (
            <TestTube className="w-4 h-4" />
          )}
          Envoyer un mail de test
        </Button>
        <Button
          onClick={handleSend}
          disabled={isSending || !to.trim() || isGenerating}
          size="lg"
          className="gap-2"
        >
          {isSending ? (
            <Spinner />
          ) : (
            <Send className="w-4 h-4" />
          )}
          Envoyer le devis
        </Button>
      </div>
    </div>
  );
}
