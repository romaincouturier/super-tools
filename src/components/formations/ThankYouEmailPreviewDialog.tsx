import { useState, useEffect } from "react";
import { Loader2, Send, Mail, Users, TestTube } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";

interface ThankYouEmailPreviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  trainingId: string;
  trainingName: string;
  supportsUrl: string | null;
  onConfirmSend: () => Promise<void>;
  isSending: boolean;
}

interface Participant {
  email: string;
  first_name: string | null;
  last_name: string | null;
}

// Default templates
const DEFAULT_CONTENT_TU = `Bonjour{{#first_name}} {{first_name}}{{/first_name}},

Quelle belle journée de découverte visuelle nous avons partagé ! Merci pour ton énergie et ta participation pendant notre formation "{{training_name}}".

Pour finaliser cette formation, j'ai besoin que tu prennes quelques minutes pour compléter le questionnaire d'évaluation :
[Lien d'évaluation personnalisé]

{{#supports_url}}Tu trouveras également tous les supports de la formation ici, pour continuer à pratiquer et intégrer ces techniques dans tes présentations :
{{supports_url}}

{{/supports_url}}Je suis curieux de voir comment tu vas utiliser tout ce que nous avons vu ! N'hésite pas à me contacter si tu as des questions ou des besoins de compléments d'informations.

Je te souhaite une bonne journée

—
{{sender_name}}
{{sender_email}}`;

const DEFAULT_CONTENT_VOUS = `Bonjour{{#first_name}} {{first_name}}{{/first_name}},

Quelle belle journée de découverte visuelle nous avons partagé ! Merci pour votre énergie et votre participation pendant notre formation "{{training_name}}".

Pour finaliser cette formation, j'ai besoin que vous preniez quelques minutes pour compléter le questionnaire d'évaluation :
[Lien d'évaluation personnalisé]

{{#supports_url}}Vous trouverez également tous les supports de la formation ici, pour continuer à pratiquer et intégrer ces techniques dans vos présentations :
{{supports_url}}

{{/supports_url}}Je suis curieux de voir comment vous allez utiliser tout ce que nous avons vu ! N'hésitez pas à me contacter si vous avez des questions ou des besoins de compléments d'informations.

Je vous souhaite une bonne journée

—
{{sender_name}}
{{sender_email}}`;

const DEFAULT_SUBJECT_TU = `Merci pour ta participation à la formation {{training_name}}`;
const DEFAULT_SUBJECT_VOUS = `Merci pour votre participation à la formation {{training_name}}`;

const ThankYouEmailPreviewDialog = ({
  open,
  onOpenChange,
  trainingId,
  trainingName,
  supportsUrl,
  onConfirmSend,
  isSending,
}: ThankYouEmailPreviewDialogProps) => {
  const { toast } = useToast();
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [loading, setLoading] = useState(false);
  const [customTemplate, setCustomTemplate] = useState<{ subject: string; content: string } | null>(null);
  const [testEmail, setTestEmail] = useState("");
  const [isSendingTest, setIsSendingTest] = useState(false);
  const [useTutoiement, setUseTutoiement] = useState(false);

  useEffect(() => {
    if (open) {
      fetchData();
    }
  }, [open, trainingId]);

  const fetchData = async () => {
    setLoading(true);
    
    // Fetch training to get formality setting
    const { data: trainingData } = await supabase
      .from("trainings")
      .select("participants_formal_address")
      .eq("id", trainingId)
      .single();
    
    const isTutoiement = trainingData?.participants_formal_address === false;
    setUseTutoiement(isTutoiement);
    
    // Fetch participants
    const { data: participantsData } = await supabase
      .from("training_participants")
      .select("email, first_name, last_name")
      .eq("training_id", trainingId);
    
    if (participantsData) {
      setParticipants(participantsData);
    }

    // Fetch custom template if exists (with mode suffix)
    const templateType = `thank_you${isTutoiement ? "_tu" : "_vous"}`;
    const { data: templateData } = await supabase
      .from("email_templates")
      .select("subject, html_content")
      .eq("template_type", templateType)
      .single();

    if (templateData) {
      setCustomTemplate({
        subject: templateData.subject,
        content: templateData.html_content,
      });
    } else {
      setCustomTemplate(null);
    }
    
    setLoading(false);
  };

  const handleSendTest = async () => {
    if (!testEmail || !testEmail.includes("@")) {
      toast({ title: "Erreur", description: "Veuillez saisir une adresse email valide", variant: "destructive" });
      return;
    }

    setIsSendingTest(true);
    try {
      const { error } = await supabase.functions.invoke("send-thank-you-email", {
        body: { 
          trainingId,
          testEmail,
        },
      });

      if (error) throw error;

      toast({ title: "Succès", description: `Email de test envoyé à ${testEmail}` });
    } catch (error) {
      console.error("Error sending test email:", error);
      toast({ title: "Erreur", description: "Erreur lors de l'envoi du mail de test", variant: "destructive" });
    } finally {
      setIsSendingTest(false);
    }
  };

  const getEmailSubject = () => {
    if (customTemplate?.subject) {
      return customTemplate.subject.replace("{{training_name}}", trainingName);
    }
    const defaultSubject = useTutoiement ? DEFAULT_SUBJECT_TU : DEFAULT_SUBJECT_VOUS;
    return defaultSubject.replace("{{training_name}}", trainingName);
  };

  const getEmailContent = (firstName?: string | null) => {
    const defaultContent = useTutoiement ? DEFAULT_CONTENT_TU : DEFAULT_CONTENT_VOUS;
    
    let content = customTemplate?.content || defaultContent;
    
    // Process conditional blocks: {{#var}}content{{/var}}
    content = content.replace(/\{\{#first_name\}\}(.*?)\{\{\/first_name\}\}/g, firstName ? `$1` : "");
    content = content.replace(/\{\{first_name\}\}/g, firstName || "");
    content = content.replace(/\{\{training_name\}\}/g, trainingName);
    content = content.replace(/\{\{evaluation_link\}\}/g, "[Lien d'évaluation personnalisé]");
    
    if (supportsUrl) {
      content = content.replace(/\{\{#supports_url\}\}([\s\S]*?)\{\{\/supports_url\}\}/g, "$1");
      content = content.replace(/\{\{supports_url\}\}/g, supportsUrl);
    } else {
      content = content.replace(/\{\{#supports_url\}\}[\s\S]*?\{\{\/supports_url\}\}/g, "");
    }
    
    return content;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Prévisualisation du mail de remerciement
          </DialogTitle>
          <DialogDescription>
            Vérifiez le contenu de l'email avant de l'envoyer aux participants
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-4">
            {/* Recipients */}
            <div className="mb-4">
              <div className="flex items-center gap-2 mb-2">
                <Users className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">Destinataires ({participants.length})</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {participants.slice(0, 10).map((p, i) => (
                  <Badge key={i} variant="secondary" className="text-xs">
                    {p.first_name || p.email.split("@")[0]}
                  </Badge>
                ))}
                {participants.length > 10 && (
                  <Badge variant="outline" className="text-xs">
                    +{participants.length - 10} autres
                  </Badge>
                )}
              </div>
            </div>

            <Separator className="my-3" />

            {/* Email preview */}
            <div className="space-y-3">
              <div>
                <span className="text-xs text-muted-foreground">Objet :</span>
                <p className="font-medium text-sm">{getEmailSubject()}</p>
              </div>

              <div>
                <span className="text-xs text-muted-foreground">Contenu :</span>
                <ScrollArea className="h-[300px] mt-1">
                  <div className="bg-muted/30 p-4 rounded-lg border">
                    <pre className="whitespace-pre-wrap text-sm font-sans leading-relaxed">
                      {getEmailContent(participants[0]?.first_name)}
                    </pre>
                  </div>
                </ScrollArea>
              </div>
            </div>

            {/* Info note */}
            <p className="text-xs text-muted-foreground mt-3">
              Note : Chaque participant recevra un email personnalisé avec son prénom et un lien d'évaluation unique.
              Une copie sera envoyée en BCC à {"{{sender_email}}"}.
              {useTutoiement ? " (Mode tutoiement)" : " (Mode vouvoiement)"}
            </p>

            {/* Test email section */}
            <Separator className="my-4" />
            <div className="space-y-2">
              <Label htmlFor="test-email" className="text-sm font-medium flex items-center gap-2">
                <TestTube className="h-4 w-4" />
                Envoyer un mail de test
              </Label>
              <div className="flex gap-2">
                <Input
                  id="test-email"
                  type="email"
                  placeholder="email@exemple.com"
                  value={testEmail}
                  onChange={(e) => setTestEmail(e.target.value)}
                  className="flex-1"
                />
                <Button
                  variant="outline"
                  onClick={handleSendTest}
                  disabled={isSendingTest || !testEmail}
                >
                  {isSendingTest ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    "Envoyer"
                  )}
                </Button>
              </div>
            </div>
          </div>
        )}

        <DialogFooter className="mt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Annuler
          </Button>
          <Button 
            onClick={onConfirmSend} 
            disabled={isSending || loading || participants.length === 0}
          >
            {isSending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Envoi en cours...
              </>
            ) : (
              <>
                <Send className="h-4 w-4 mr-2" />
                Envoyer à {participants.length} participant{participants.length > 1 ? "s" : ""}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ThankYouEmailPreviewDialog;
