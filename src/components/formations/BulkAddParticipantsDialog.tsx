import { useState } from "react";
import { Users, Loader2, AlertCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
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
  onParticipantsAdded: () => void;
}

interface ParsedParticipant {
  email: string;
  firstName?: string;
  lastName?: string;
  company?: string;
}

const BulkAddParticipantsDialog = ({ trainingId, onParticipantsAdded }: BulkAddParticipantsDialogProps) => {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [bulkText, setBulkText] = useState("");
  const [parseErrors, setParseErrors] = useState<string[]>([]);
  const { toast } = useToast();

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
      const toInsert = participants.map((p) => ({
        training_id: trainingId,
        email: p.email,
        first_name: p.firstName || null,
        last_name: p.lastName || null,
        company: p.company || null,
        needs_survey_token: crypto.randomUUID(),
        needs_survey_status: "non_envoye",
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

      const insertedCount = data?.length || 0;
      
      toast({
        title: "Participants ajoutés",
        description: `${insertedCount} participant${insertedCount !== 1 ? "s" : ""} ajouté${insertedCount !== 1 ? "s" : ""}.`,
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
