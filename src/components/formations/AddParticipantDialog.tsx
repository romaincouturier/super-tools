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
  formatFormation?: string | null;
  onParticipantAdded: () => void;
}

const AddParticipantDialog = ({ trainingId, trainingStartDate, clientName, formatFormation, onParticipantAdded }: AddParticipantDialogProps) => {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [company, setCompany] = useState("");
  const [sponsorFirstName, setSponsorFirstName] = useState("");
  const [sponsorLastName, setSponsorLastName] = useState("");
  const [sponsorEmail, setSponsorEmail] = useState("");
  const [isManualMode, setIsManualMode] = useState(false);
  const { toast } = useToast();
  
  const isInterEntreprise = formatFormation === "inter-entreprises";

  // Determine email scheduling mode based on training date
  // - If training already started (past date) -> no email
  // - If training is upcoming -> send welcome email immediately
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
    
    // Training is in the future -> send welcome email immediately
    return { status: "accueil_envoye", sendWelcomeNow: true };
  };

  useEffect(() => {
    if (trainingStartDate) {
      const { status } = getEmailMode();
      setIsManualMode(status === "non_envoye");
    }
  }, [trainingStartDate]);

  const resetForm = () => {
    setFirstName("");
    setLastName("");
    setEmail("");
    setCompany("");
    setSponsorFirstName("");
    setSponsorLastName("");
    setSponsorEmail("");
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

      const participantData = {
        training_id: trainingId,
        first_name: firstName.trim() || null,
        last_name: lastName.trim() || null,
        email: email.trim().toLowerCase(),
        company: company.trim() || null,
        needs_survey_token: token,
        needs_survey_status: status,
        // For inter-enterprise trainings, add sponsor fields
        ...(isInterEntreprise && {
          sponsor_first_name: sponsorFirstName.trim() || null,
          sponsor_last_name: sponsorLastName.trim() || null,
          sponsor_email: sponsorEmail.trim().toLowerCase() || null,
        }),
      };

      const { data: insertedParticipant, error } = await supabase.from("training_participants").insert(participantData).select().single();

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

      // Schedule needs survey email for future trainings (after welcome email is sent)
      if (sendWelcomeNow && insertedParticipant && trainingStartDate) {
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
      } else if (sendWelcomeNow) {
        statusMessage = "Mail d'accueil envoyé avec le lien vers la page formation.";
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
                La formation est déjà passée ou commence aujourd'hui. Aucun mail ne sera envoyé automatiquement.
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

            {/* Sponsor/Commanditaire fields for inter-enterprise trainings */}
            {isInterEntreprise && (
              <>
                <div className="pt-4 border-t">
                  <Label className="text-sm font-medium text-muted-foreground">Commanditaire (facturation)</Label>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="sponsorFirstName">Prénom</Label>
                    <Input
                      id="sponsorFirstName"
                      value={sponsorFirstName}
                      onChange={(e) => setSponsorFirstName(e.target.value)}
                      placeholder="Marie"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="sponsorLastName">Nom</Label>
                    <Input
                      id="sponsorLastName"
                      value={sponsorLastName}
                      onChange={(e) => setSponsorLastName(e.target.value)}
                      placeholder="Martin"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="sponsorEmail">Email du commanditaire *</Label>
                  <Input
                    id="sponsorEmail"
                    type="email"
                    value={sponsorEmail}
                    onChange={(e) => setSponsorEmail(e.target.value)}
                    placeholder="marie.martin@example.com"
                    required={isInterEntreprise}
                  />
                </div>
              </>
            )}
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
