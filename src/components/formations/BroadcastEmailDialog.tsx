import { useState, useEffect } from "react";
import { Send, Mail, Users, Megaphone } from "lucide-react";
import { Spinner } from "@/components/ui/spinner";
import { supabase } from "@/integrations/supabase/client";
import { useEdgeFunction } from "@/hooks/useEdgeFunction";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";

interface BroadcastEmailDialogProps {
  trainingId: string;
  trainingName: string;
  participantCount: number;
}

const BroadcastEmailDialog = ({
  trainingId,
  trainingName,
  participantCount,
}: BroadcastEmailDialogProps) => {
  const [open, setOpen] = useState(false);
  const [subject, setSubject] = useState("");
  const [content, setContent] = useState("");
  const [participants, setParticipants] = useState<{ email: string; first_name: string | null; last_name: string | null }[]>([]);
  const { loading: sending, invoke: invokeBroadcast } = useEdgeFunction<{ recipientCount: number }>(
    "send-broadcast-email",
    { errorMessage: "Erreur lors de l'envoi de l'email" },
  );

  useEffect(() => {
    if (open) {
      supabase
        .from("training_participants")
        .select("email, first_name, last_name")
        .eq("training_id", trainingId)
        .then(({ data }) => {
          if (data) setParticipants(data);
        });
    }
  }, [open, trainingId]);

  const handleSend = async () => {
    if (!subject.trim() || !content.trim()) {
      toast.error("L'objet et le contenu sont requis");
      return;
    }

    const data = await invokeBroadcast({ trainingId, subject: subject.trim(), content: content.trim() });
    if (data) {
      toast.success(`Email envoyé à ${data.recipientCount} participant${data.recipientCount > 1 ? "s" : ""}`);
      setOpen(false);
      setSubject("");
      setContent("");
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" disabled={participantCount === 0}>
          <Megaphone className="h-4 w-4 mr-2" />
          Email groupé
        </Button>
      </DialogTrigger>
      <DialogContent className="w-full sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Envoyer un email à tous les participants
          </DialogTitle>
          <DialogDescription>
            L'email sera envoyé individuellement à chaque participant avec la signature Signitic.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Recipients */}
          <div>
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

          <Separator />

          {/* Subject */}
          <div className="space-y-2">
            <Label htmlFor="broadcast-subject">Objet</Label>
            <Input
              id="broadcast-subject"
              placeholder={`Information concernant la formation ${trainingName}`}
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
            />
          </div>

          {/* Content */}
          <div className="space-y-2">
            <Label htmlFor="broadcast-content">Contenu</Label>
            <Textarea
              id="broadcast-content"
              placeholder="Bonjour {{first_name}},&#10;&#10;..."
              value={content}
              onChange={(e) => setContent(e.target.value)}
              className="min-h-[200px] resize-y"
            />
            <p className="text-xs text-muted-foreground">
              Variables disponibles : <code className="text-xs bg-muted px-1 rounded">{"{{first_name}}"}</code>, <code className="text-xs bg-muted px-1 rounded">{"{{display_name}}"}</code>
            </p>
          </div>

          <p className="text-xs text-muted-foreground">
            La signature Signitic sera automatiquement ajoutée à chaque email. Une copie BCC sera envoyée.
          </p>
        </div>

        <DialogFooter className="mt-4">
          <Button variant="outline" onClick={() => setOpen(false)}>
            Annuler
          </Button>
          <Button onClick={handleSend} disabled={sending || !subject.trim() || !content.trim()}>
            {sending ? (
              <>
                <Spinner className="mr-2" />
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

export default BroadcastEmailDialog;
