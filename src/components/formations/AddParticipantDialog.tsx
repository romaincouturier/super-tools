import { useState, useEffect } from "react";
import { Plus, Loader2, AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { differenceInDays, parseISO, format } from "date-fns";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { subtractWorkingDays, fetchWorkingDays, fetchNeedsSurveyDelay } from "@/lib/workingDays";

interface AddParticipantDialogProps {
  trainingId: string;
  trainingStartDate?: string;
  clientName?: string;
  onParticipantAdded: () => void;
}

const AddParticipantDialog = ({ trainingId, trainingStartDate, clientName, onParticipantAdded }: AddParticipantDialogProps) => {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [company, setCompany] = useState(clientName || "");
  const [isManualMode, setIsManualMode] = useState(false);
  const { toast } = useToast();

  // Determine email scheduling mode based on training date
  // - If training already started (past date) -> no email
  // - If training starts in less than 2 days -> manual mode
  // - If training starts between 2-7 days -> send welcome email immediately
  // - Otherwise -> schedule needs survey
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

  const resetForm = () => {
    setFirstName("");
    setLastName("");
    setEmail("");
    setCompany(clientName || "");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!email.trim()) {
      toast({
        title: "Email requis",
        description: "L'adresse email est obligatoire.",
        variant: "destructive",
      });
      return;
    }

    setSaving(true);

    try {
      // Generate unique token for needs survey
      const token = crypto.randomUUID();

      // Determine initial status and whether to send welcome email
      const { status, sendWelcomeNow } = getEmailMode();

      const { data: insertedParticipant, error } = await supabase.from("training_participants").insert({
        training_id: trainingId,
        first_name: firstName.trim() || null,
        last_name: lastName.trim() || null,
        email: email.trim().toLowerCase(),
        company: company.trim() || null,
        needs_survey_token: token,
        needs_survey_status: status,
      }).select().single();

      if (error) {
        if (error.code === "23505") {
          toast({
            title: "Participant déjà inscrit",
            description: "Un participant avec cet email est déjà inscrit à cette formation.",
            variant: "destructive",
          });
        } else {
          throw error;
        }
        return;
      }
      // If we need to send welcome email now (J-7 to J-2 window), trigger the edge function
      if (sendWelcomeNow && insertedParticipant) {
        try {
          await supabase.functions.invoke("send-welcome-email", {
            body: {
              participantId: insertedParticipant.id,
              trainingId,
            },
          });
        } catch (emailError) {
          console.error("Failed to send welcome email:", emailError);
          // Don't fail the whole operation, just log the error
        }
      }

      // If status is "programme", create a scheduled email for needs survey
      if (status === "programme" && insertedParticipant && trainingStartDate) {
        try {
          const [workingDays, needsSurveyDelay] = await Promise.all([
            fetchWorkingDays(supabase),
            fetchNeedsSurveyDelay(supabase),
          ]);

          const startDate = parseISO(trainingStartDate);
          const scheduledDate = subtractWorkingDays(startDate, needsSurveyDelay, workingDays);
          
          // Only schedule if the date is in the future
          if (scheduledDate > new Date()) {
            await supabase.from("scheduled_emails").insert({
              training_id: trainingId,
              participant_id: insertedParticipant.id,
              email_type: "needs_survey",
              scheduled_for: format(scheduledDate, "yyyy-MM-dd'T'09:00:00"),
              status: "pending",
            });
          }
        } catch (scheduleError) {
          console.error("Failed to schedule needs survey email:", scheduleError);
        }
      }

      // Log activity
      await supabase.from("activity_logs").insert({
        action_type: "participant_added",
        recipient_email: email.trim().toLowerCase(),
        details: {
          training_id: trainingId,
          participant_name: `${firstName.trim() || ""} ${lastName.trim() || ""}`.trim() || null,
          company: company.trim() || null,
        },
      });

      let statusMessage = "";
      if (status === "non_envoye") {
        statusMessage = "Formation passée - pas d'envoi programmé.";
      } else if (status === "manuel") {
        statusMessage = "Mode manuel activé (formation proche).";
      } else if (status === "accueil_envoye" || sendWelcomeNow) {
        statusMessage = "Mail d'accueil envoyé.";
      } else {
        statusMessage = "Recueil des besoins programmé.";
      }

      toast({
        title: "Participant ajouté",
        description: `${email} a été ajouté. ${statusMessage}`,
      });

      resetForm();
      setOpen(false);
      onParticipantAdded();
    } catch (error: any) {
      console.error("Error adding participant:", error);
      toast({
        title: "Erreur",
        description: error.message || "Une erreur est survenue.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="h-4 w-4 mr-2" />
          Ajouter
        </Button>
      </DialogTrigger>
      <DialogContent>
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Ajouter un participant</DialogTitle>
            <DialogDescription>
              Ajoutez un participant à cette formation. Seul l'email est obligatoire.
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
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="firstName">Prénom</Label>
                <Input
                  id="firstName"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  placeholder="Jean"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="lastName">Nom</Label>
                <Input
                  id="lastName"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  placeholder="Dupont"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email *</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="jean.dupont@example.com"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="company">Société</Label>
              <Input
                id="company"
                value={company}
                onChange={(e) => setCompany(e.target.value)}
                placeholder="ACME Corp"
              />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Annuler
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Ajout...
                </>
              ) : (
                "Ajouter"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default AddParticipantDialog;
