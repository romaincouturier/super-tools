import { useState, useEffect } from "react";
import { Users, Loader2, AlertCircle, AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { differenceInDays, parseISO } from "date-fns";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";

interface BulkAddParticipantsDialogProps {
  trainingId: string;
  trainingStartDate?: string;
  onParticipantsAdded: () => void;
}

interface ParsedParticipant {
  email: string;
  firstName?: string;
  lastName?: string;
  company?: string;
}

const BulkAddParticipantsDialog = ({ trainingId, trainingStartDate, onParticipantsAdded }: BulkAddParticipantsDialogProps) => {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [bulkText, setBulkText] = useState("");
  const [parseErrors, setParseErrors] = useState<string[]>([]);
  const [isManualMode, setIsManualMode] = useState(false);
  const { toast } = useToast();

  // Determine email scheduling mode based on training date
  const getEmailMode = (): { status: string; sendWelcomeNow: boolean } => {
    if (!trainingStartDate) {
      return { status: "programme", sendWelcomeNow: false };
    }
    
    const startDate = parseISO(trainingStartDate);
    const today = new Date();
    const daysUntilStart = differenceInDays(startDate, today);
    
    // Training already started or is today
    if (daysUntilStart <= 0) {
      return { status: "non_envoye", sendWelcomeNow: false };
    }
    
    // Training starts in less than 2 days
    if (daysUntilStart < 2) {
      return { status: "manuel", sendWelcomeNow: false };
    }
    
    // Training starts between 2-7 days -> send welcome email immediately
    if (daysUntilStart <= 7) {
      return { status: "accueil_envoye", sendWelcomeNow: true };
    }
    
    // Training is more than 7 days away -> schedule normally
    return { status: "programme", sendWelcomeNow: false };
  };

  useEffect(() => {
    if (trainingStartDate) {
      const { status } = getEmailMode();
      setIsManualMode(status === "manuel" || status === "non_envoye");
    }
  }, [trainingStartDate]);

  const parseParticipants = (text: string): ParsedParticipant[] => {
    const lines = text.split("\n").filter((line) => line.trim());
    const participants: ParsedParticipant[] = [];
    const errors: string[] = [];

    lines.forEach((line, index) => {
      const trimmedLine = line.trim();
      
      // Try to parse as: email, or firstName lastName <email>, or email; firstName; lastName; company
      const emailRegex = /[\w.-]+@[\w.-]+\.\w+/;
      const emailMatch = trimmedLine.match(emailRegex);

      if (!emailMatch) {
        errors.push(`Ligne ${index + 1}: Email invalide`);
        return;
      }

      const email = emailMatch[0].toLowerCase();
      
      // Try to extract name if present
      let firstName: string | undefined;
      let lastName: string | undefined;
      let company: string | undefined;

      // Check if format is "First Last <email>" or "email" or "email; first; last; company"
      if (trimmedLine.includes(";")) {
        const parts = trimmedLine.split(";").map((p) => p.trim());
        // Format: email; firstName; lastName; company
        if (parts.length >= 2) firstName = parts[1] || undefined;
        if (parts.length >= 3) lastName = parts[2] || undefined;
        if (parts.length >= 4) company = parts[3] || undefined;
      } else if (trimmedLine.includes("<") && trimmedLine.includes(">")) {
        // Format: "First Last <email>"
        const namePart = trimmedLine.split("<")[0].trim();
        const nameParts = namePart.split(" ").filter(Boolean);
        if (nameParts.length >= 1) firstName = nameParts[0];
        if (nameParts.length >= 2) lastName = nameParts.slice(1).join(" ");
      }

      participants.push({ email, firstName, lastName, company });
    });

    setParseErrors(errors);
    return participants;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const participants = parseParticipants(bulkText);

    if (participants.length === 0) {
      toast({
        title: "Aucun participant",
        description: "Veuillez entrer au moins une adresse email valide.",
        variant: "destructive",
      });
      return;
    }

    setSaving(true);

    try {
      // Determine initial status based on training proximity
      const { status, sendWelcomeNow } = getEmailMode();

      const toInsert = participants.map((p) => ({
        training_id: trainingId,
        email: p.email,
        first_name: p.firstName || null,
        last_name: p.lastName || null,
        company: p.company || null,
        needs_survey_token: crypto.randomUUID(),
        needs_survey_status: status,
      }));

      const { data, error } = await supabase
        .from("training_participants")
        .insert(toInsert)
        .select();

      if (error) {
        if (error.code === "23505") {
          toast({
            title: "Doublons détectés",
            description: "Certains participants étaient déjà inscrits et ont été ignorés.",
            variant: "default",
          });
        } else {
          throw error;
        }
      }

      // If we need to send welcome emails now (J-7 to J-2 window), trigger for each participant
      if (sendWelcomeNow && data && data.length > 0) {
        // Send welcome emails with a small delay between each to respect rate limits
        for (const participant of data) {
          try {
            await supabase.functions.invoke("send-welcome-email", {
              body: {
                participantId: participant.id,
                trainingId,
              },
            });
            // Small delay between emails (500ms)
            await new Promise(resolve => setTimeout(resolve, 500));
          } catch (emailError) {
            console.error("Failed to send welcome email to:", participant.email, emailError);
          }
        }
      }

      const insertedCount = data?.length || 0;
      let statusMessage = "";
      if (status === "non_envoye") {
        statusMessage = "Formation passée - pas d'envoi programmé.";
      } else if (status === "manuel") {
        statusMessage = "Mode manuel activé (formation proche).";
      } else if (status === "accueil_envoye" || sendWelcomeNow) {
        statusMessage = "Mails d'accueil envoyés.";
      } else {
        statusMessage = "Recueil des besoins programmé.";
      }
      
      toast({
        title: "Participants ajoutés",
        description: `${insertedCount} participant${insertedCount !== 1 ? "s" : ""} ajouté${insertedCount !== 1 ? "s" : ""}. ${statusMessage}`,
      });

      setBulkText("");
      setParseErrors([]);
      setOpen(false);
      onParticipantsAdded();
    } catch (error: any) {
      console.error("Error adding participants:", error);
      toast({
        title: "Erreur",
        description: error.message || "Une erreur est survenue.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const parsedParticipants = bulkText ? parseParticipants(bulkText) : [];

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <Users className="h-4 w-4 mr-2" />
          Ajout en lot
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Ajouter plusieurs participants</DialogTitle>
            <DialogDescription>
              Entrez les participants, un par ligne. Formats acceptés :
              <br />
              • email@example.com
              <br />
              • Prénom Nom &lt;email@example.com&gt;
              <br />
              • email@example.com; Prénom; Nom; Société
            </DialogDescription>
          </DialogHeader>

          {isManualMode && (
            <Alert className="mt-4">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                {trainingStartDate && differenceInDays(parseISO(trainingStartDate), new Date()) <= 0 
                  ? "La formation est déjà passée ou commence aujourd'hui. Aucun mail ne sera envoyé automatiquement."
                  : "La formation commence dans moins de 2 jours. Le recueil des besoins sera en mode manuel."}
              </AlertDescription>
            </Alert>
          )}

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="bulkText">Participants</Label>
              <Textarea
                id="bulkText"
                value={bulkText}
                onChange={(e) => setBulkText(e.target.value)}
                placeholder={`jean.dupont@example.com
Marie Martin <marie.martin@example.com>
pierre.durand@example.com; Pierre; Durand; ACME Corp`}
                rows={8}
                className="font-mono text-sm"
              />
            </div>

            {parseErrors.length > 0 && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  {parseErrors.map((error, i) => (
                    <div key={i}>{error}</div>
                  ))}
                </AlertDescription>
              </Alert>
            )}

            {parsedParticipants.length > 0 && (
              <div className="text-sm text-muted-foreground">
                {parsedParticipants.length} participant{parsedParticipants.length !== 1 ? "s" : ""} détecté{parsedParticipants.length !== 1 ? "s" : ""}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Annuler
            </Button>
            <Button type="submit" disabled={saving || parsedParticipants.length === 0}>
              {saving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Ajout...
                </>
              ) : (
                `Ajouter ${parsedParticipants.length} participant${parsedParticipants.length !== 1 ? "s" : ""}`
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default BulkAddParticipantsDialog;
