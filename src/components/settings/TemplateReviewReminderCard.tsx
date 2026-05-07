import { useState, useEffect } from "react";
import { Bell, Send } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { toastError } from "@/lib/toastError";

const FREQUENCY_LABEL: Record<string, string> = {
  monthly: "Mensuelle",
  quarterly: "Trimestrielle",
  biannual: "Semestrielle",
};

const TemplateReviewReminderCard = () => {
  const { toast } = useToast();
  const [enabled, setEnabled] = useState(true);
  const [frequency, setFrequency] = useState("quarterly");
  const [lastSent, setLastSent] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("app_settings")
        .select("setting_key, setting_value")
        .in("setting_key", [
          "template_review_reminder_enabled",
          "template_review_reminder_frequency",
          "template_review_reminder_last_sent",
        ]);
      const map = Object.fromEntries((data || []).map((r) => [r.setting_key, r.setting_value]));
      setEnabled(map.template_review_reminder_enabled !== "false");
      setFrequency(map.template_review_reminder_frequency || "quarterly");
      setLastSent(map.template_review_reminder_last_sent || null);
      setLoading(false);
    })();
  }, []);

  const persist = async (key: string, value: string) => {
    const { error } = await supabase
      .from("app_settings")
      .upsert({ setting_key: key, setting_value: value }, { onConflict: "setting_key" });
    if (error) toastError(toast, error.message);
  };

  const handleEnabledChange = async (v: boolean) => {
    setEnabled(v);
    await persist("template_review_reminder_enabled", String(v));
    toast({ title: v ? "Rappel activé" : "Rappel désactivé" });
  };

  const handleFrequencyChange = async (v: string) => {
    setFrequency(v);
    await persist("template_review_reminder_frequency", v);
    toast({ title: "Fréquence mise à jour", description: FREQUENCY_LABEL[v] });
  };

  const handleSendNow = async () => {
    setSending(true);
    try {
      const { data, error } = await supabase.functions.invoke("send-template-review-reminder", {
        body: { force: true },
      });
      if (error) throw error;
      if (data?.success === false) throw new Error("Envoi échoué");
      toast({
        title: "Rappel envoyé",
        description: `Email envoyé à ${data?.recipientCount ?? 0} destinataire(s).`,
      });
      setLastSent(new Date().toISOString());
    } catch (err) {
      toastError(toast, err instanceof Error ? err : "Erreur d'envoi");
    } finally {
      setSending(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Bell className="h-4 w-4" />
          Rappel de revue des templates
        </CardTitle>
        <CardDescription>
          Email automatique envoyé aux admins et au responsable communication pour réviser périodiquement
          tous les templates de communication (formation, CRM, snippets).
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading ? (
          <Spinner />
        ) : (
          <>
            <div className="flex items-center justify-between gap-4">
              <Label htmlFor="reminder-enabled" className="cursor-pointer">
                Activer le rappel
              </Label>
              <Switch id="reminder-enabled" checked={enabled} onCheckedChange={handleEnabledChange} />
            </div>

            <div className="flex items-center justify-between gap-4">
              <Label>Fréquence</Label>
              <Select value={frequency} onValueChange={handleFrequencyChange} disabled={!enabled}>
                <SelectTrigger className="w-44">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="monthly">Mensuelle</SelectItem>
                  <SelectItem value="quarterly">Trimestrielle</SelectItem>
                  <SelectItem value="biannual">Semestrielle</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="text-xs text-muted-foreground">
              {lastSent
                ? `Dernier envoi : ${new Date(lastSent).toLocaleString("fr-FR")}`
                : "Aucun envoi pour le moment."}
            </div>

            <Button variant="outline" size="sm" onClick={handleSendNow} disabled={sending}>
              {sending ? <Spinner className="mr-2" /> : <Send className="h-4 w-4 mr-2" />}
              Envoyer maintenant
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
};

export default TemplateReviewReminderCard;
