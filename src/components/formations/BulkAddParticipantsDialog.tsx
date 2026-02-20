import { useState, useEffect, useMemo } from "react";
import { Users, Loader2, AlertCircle, AlertTriangle } from "lucide-react";
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
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { subtractWorkingDays, fetchWorkingDays, fetchNeedsSurveyDelay, scheduleTrainerSummaryIfNeeded } from "@/lib/workingDays";

interface BulkAddParticipantsDialogProps {
  trainingId: string;
  trainingStartDate?: string;
  onParticipantsAdded: () => void;
  isInterEntreprise?: boolean;
  formatFormation?: string | null;
}

const capitalizeName = (name: string): string => {
  const trimmed = name.trim();
  if (!trimmed) return "";
  return trimmed
    .split(/(\s+|-)/g)
    .map((part) => {
      if (part === "-" || /^\s+$/.test(part)) return part;
      return part.charAt(0).toUpperCase() + part.slice(1).toLowerCase();
    })
    .join("");
};

interface ParsedParticipant {
  email: string;
  firstName?: string;
  lastName?: string;
  company?: string;
  // Sponsor fields for inter-entreprise
  sponsorFirstName?: string;
  sponsorLastName?: string;
  sponsorEmail?: string;
}

const BulkAddParticipantsDialog = ({ 
  trainingId, 
  trainingStartDate, 
  onParticipantsAdded,
  isInterEntreprise = false,
  formatFormation,
}: BulkAddParticipantsDialogProps) => {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [bulkText, setBulkText] = useState("");
  
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

  const parseParticipants = (text: string): { participants: ParsedParticipant[]; errors: string[] } => {
    const lines = text.split("\n").filter((line) => line.trim());
    const participants: ParsedParticipant[] = [];
    const errors: string[] = [];

    const emailRegex = /[\w.-]+@[\w.-]+\.\w+/g;

    lines.forEach((line, index) => {
      const trimmedLine = line.trim();
      
      if (isInterEntreprise) {
        // Inter-entreprise format: "Prénom Nom email, Société | Prénom_Cmd Nom_Cmd email_cmd"
        // or: "Prénom Nom email, Société | email_cmd"
        const parts = trimmedLine.split("|").map(p => p.trim());
        const participantPart = parts[0];
        const sponsorPart = parts[1] || "";
        
        // Parse participant part
        const participantEmails = participantPart.match(emailRegex);
        if (!participantEmails || participantEmails.length === 0) {
          errors.push(`Ligne ${index + 1}: Email du participant invalide`);
          return;
        }
        
        const participantEmail = participantEmails[0].toLowerCase();
        
        let firstName: string | undefined;
        let lastName: string | undefined;
        let company: string | undefined;
        
        // Check for company after comma
        if (participantPart.includes(",")) {
          const [beforeComma, afterComma] = participantPart.split(",").map((p) => p.trim());
          company = afterComma || undefined;
          
          // Extract name from the part before email
          const beforeEmail = beforeComma.replace(emailRegex, "").trim();
          if (beforeEmail) {
            const nameParts = beforeEmail.split(/\s+/).filter(Boolean);
            if (nameParts.length >= 1) firstName = nameParts[0];
            if (nameParts.length >= 2) lastName = nameParts.slice(1).join(" ");
          }
        } else {
          const beforeEmail = participantPart.replace(emailRegex, "").trim();
          if (beforeEmail) {
            const nameParts = beforeEmail.split(/\s+/).filter(Boolean);
            if (nameParts.length >= 1) firstName = nameParts[0];
            if (nameParts.length >= 2) lastName = nameParts.slice(1).join(" ");
          }
        }
        
        // Parse sponsor part if provided
        let sponsorFirstName: string | undefined;
        let sponsorLastName: string | undefined;
        let sponsorEmail: string | undefined;
        
        if (sponsorPart) {
          const sponsorEmails = sponsorPart.match(emailRegex);
          if (sponsorEmails && sponsorEmails.length > 0) {
            sponsorEmail = sponsorEmails[0].toLowerCase();
            
            // Extract sponsor name from before the email
            const beforeSponsorEmail = sponsorPart.replace(emailRegex, "").trim();
            if (beforeSponsorEmail) {
              const sponsorNameParts = beforeSponsorEmail.split(/\s+/).filter(Boolean);
              if (sponsorNameParts.length >= 1) sponsorFirstName = sponsorNameParts[0];
              if (sponsorNameParts.length >= 2) sponsorLastName = sponsorNameParts.slice(1).join(" ");
            }
          }
        }
        
        participants.push({ 
          email: participantEmail, 
          firstName, 
          lastName, 
          company,
          sponsorFirstName,
          sponsorLastName,
          sponsorEmail
        });
      } else {
        // Standard format (non inter-entreprise)
        const emailMatch = trimmedLine.match(/[\w.-]+@[\w.-]+\.\w+/);

        if (!emailMatch) {
          errors.push(`Ligne ${index + 1}: Email invalide`);
          return;
        }

        const email = emailMatch[0].toLowerCase();
        
        let firstName: string | undefined;
        let lastName: string | undefined;
        let company: string | undefined;

        // Check if format is "Prénom Nom email, Société" or just "email"
        if (trimmedLine.includes(",")) {
          // Format: "Prénom Nom email, Société"
          const [beforeComma, afterComma] = trimmedLine.split(",").map((p) => p.trim());
          company = afterComma || undefined;
          
          // Extract name from the part before email
          const beforeEmail = beforeComma.replace(/[\w.-]+@[\w.-]+\.\w+/, "").trim();
          if (beforeEmail) {
            const nameParts = beforeEmail.split(/\s+/).filter(Boolean);
            if (nameParts.length >= 1) firstName = nameParts[0];
            if (nameParts.length >= 2) lastName = nameParts.slice(1).join(" ");
          }
        } else {
          // Check if there's text before the email (Prénom Nom email format)
          const beforeEmail = trimmedLine.replace(/[\w.-]+@[\w.-]+\.\w+/, "").trim();
          if (beforeEmail) {
            const nameParts = beforeEmail.split(/\s+/).filter(Boolean);
            if (nameParts.length >= 1) firstName = nameParts[0];
            if (nameParts.length >= 2) lastName = nameParts.slice(1).join(" ");
          }
        }

        participants.push({ email, firstName, lastName, company });
      }
    });

    return { participants, errors };
  };

  const { parsedParticipants, parseErrors } = useMemo(() => {
    if (!bulkText) {
      return { parsedParticipants: [], parseErrors: [] };
    }
    const result = parseParticipants(bulkText);
    return { parsedParticipants: result.participants, parseErrors: result.errors };
  }, [bulkText, isInterEntreprise]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (parsedParticipants.length === 0) {
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

      const toInsert = parsedParticipants.map((p) => ({
        training_id: trainingId,
        email: p.email,
        first_name: capitalizeName(p.firstName || "") || null,
        last_name: capitalizeName(p.lastName || "") || null,
        company: p.company || null,
        needs_survey_token: crypto.randomUUID(),
        needs_survey_status: status,
        // Sponsor fields for inter-entreprise
        sponsor_first_name: capitalizeName(p.sponsorFirstName || "") || null,
        sponsor_last_name: capitalizeName(p.sponsorLastName || "") || null,
        sponsor_email: p.sponsorEmail || null,
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

      // Create questionnaire_besoins records immediately so links work from day 1
      if (data && data.length > 0) {
        try {
          const questionnaireRecords = data.map((p) => ({
            participant_id: p.id,
            training_id: trainingId,
            token: p.needs_survey_token,
            etat: "non_envoye",
            email: p.email,
            prenom: p.first_name,
            nom: p.last_name,
            societe: p.company,
          }));
          await supabase.from("questionnaire_besoins").insert(questionnaireRecords);
        } catch (qErr) {
          console.warn("Failed to pre-create questionnaire records:", qErr);
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

      // For e-learning: generate coupon + send access email to each participant
      if (formatFormation === "e_learning" && data && data.length > 0) {
        for (const participant of data) {
          try {
            // Try to generate WooCommerce coupon
            let couponCode: string | undefined;
            try {
              const { data: couponData } = await supabase.functions.invoke("generate-woocommerce-coupon", {
                body: {
                  participantId: participant.id,
                  trainingId,
                },
              });
              if (couponData?.coupon_code) {
                couponCode = couponData.coupon_code;
              }
            } catch (couponErr) {
              console.error("Failed to generate coupon for:", participant.email, couponErr);
            }

            // Send e-learning access email with coupon if available
            await supabase.functions.invoke("send-elearning-access", {
              body: {
                participantId: participant.id,
                trainingId,
                couponCode,
              },
            });
            await new Promise(resolve => setTimeout(resolve, 500));
          } catch (emailError) {
            console.error("Failed to send e-learning access email to:", participant.email, emailError);
          }
        }
      }

      // If status is "programme", create scheduled emails for needs survey
      let needsSurveySkipped = false;
      if (status === "programme" && data && data.length > 0 && trainingStartDate) {
        try {
          const [workingDays, needsSurveyDelay] = await Promise.all([
            fetchWorkingDays(supabase),
            fetchNeedsSurveyDelay(supabase),
          ]);

          const startDate = parseISO(trainingStartDate);
          const scheduledDate = subtractWorkingDays(startDate, needsSurveyDelay, workingDays);

          // Only schedule if the date is in the future
          if (scheduledDate > new Date()) {
            const scheduledEmails = data.map((participant) => ({
              training_id: trainingId,
              participant_id: participant.id,
              email_type: "needs_survey",
              scheduled_for: format(scheduledDate, "yyyy-MM-dd'T'09:00:00"),
              status: "pending",
            }));

            await supabase.from("scheduled_emails").insert(scheduledEmails);
          } else {
            needsSurveySkipped = true;
          }
        } catch (scheduleError) {
          console.error("Failed to schedule needs survey emails:", scheduleError);
        }
      }

      // Schedule trainer summary email if not already scheduled
      if (trainingStartDate && status !== "non_envoye") {
        await scheduleTrainerSummaryIfNeeded(supabase, trainingId, trainingStartDate);
      }

      // Log activity
      if (data && data.length > 0) {
        const logInserts = data.map((p) => ({
          action_type: "participant_added",
          recipient_email: p.email,
          details: {
            training_id: trainingId,
            participant_name: `${p.first_name || ""} ${p.last_name || ""}`.trim() || null,
            company: p.company || null,
            bulk_add: true,
            has_sponsor: isInterEntreprise && !!p.sponsor_email,
          },
        }));
        await supabase.from("activity_logs").insert(logInserts);
      }

      const insertedCount = data?.length || 0;
      let statusMessage = "";
      if (status === "non_envoye") {
        statusMessage = "Formation passée — aucun email programmé.";
      } else if (status === "manuel") {
        statusMessage = "Mode manuel activé (formation proche).";
      } else if ((status === "accueil_envoye" || sendWelcomeNow) && needsSurveySkipped) {
        statusMessage = "Mails d'accueil envoyés. ⚠️ Le recueil des besoins n'a pas été programmé car la date d'envoi est dépassée.";
      } else if (status === "accueil_envoye" || sendWelcomeNow) {
        statusMessage = "Mails d'accueil envoyés, recueil des besoins programmé.";
      } else if (needsSurveySkipped) {
        statusMessage = "⚠️ Le recueil des besoins n'a pas été programmé car la date d'envoi est dépassée.";
      } else {
        statusMessage = "Recueil des besoins programmé.";
      }

      toast({
        title: "Participants ajoutés",
        description: `${insertedCount} participant${insertedCount !== 1 ? "s" : ""} ajouté${insertedCount !== 1 ? "s" : ""}. ${statusMessage}`,
        ...(needsSurveySkipped && { duration: 8000 }),
      });

      setBulkText("");
      setOpen(false);
      onParticipantsAdded();
    } catch (error: unknown) {
      console.error("Error adding participants:", error);
      toast({
        title: "Erreur",
        description: error instanceof Error ? error.message : "Une erreur est survenue.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const getPlaceholder = () => {
    if (isInterEntreprise) {
      return `jean.dupont@example.com, ACME Corp | Marie Sponsor marie.sponsor@acme.com
Pierre Martin pierre.martin@test.fr, Tech SA | sponsor@tech.fr`;
    }
    return `jean.dupont@example.com
Marie Martin marie.martin@example.com, ACME Corp`;
  };

  const getDescription = () => {
    if (isInterEntreprise) {
      return (
        <>
          Entrez les participants, un par ligne. Format inter-entreprises :
          <br />
          • Prénom Nom email, Société | Prénom_Cmd Nom_Cmd email_cmd
          <br />
          • email, Société | email_commanditaire
          <br />
          <span className="text-muted-foreground text-xs">
            Le symbole | sépare les infos du participant de celles du commanditaire
          </span>
        </>
      );
    }
    return (
      <>
        Entrez les participants, un par ligne. Formats acceptés :
        <br />
        • email@example.com
        <br />
        • Prénom Nom email@example.com, Société
      </>
    );
  };

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
            <DialogTitle>
              Ajouter plusieurs participants
              {isInterEntreprise && (
                <span className="ml-2 text-sm font-normal text-muted-foreground">
                  (Inter-entreprises)
                </span>
              )}
            </DialogTitle>
            <DialogDescription>
              {getDescription()}
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
                placeholder={getPlaceholder()}
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
              <div className="text-sm text-muted-foreground space-y-1">
                <div>
                  {parsedParticipants.length} participant{parsedParticipants.length !== 1 ? "s" : ""} détecté{parsedParticipants.length !== 1 ? "s" : ""}
                </div>
                {isInterEntreprise && (
                  <div className="text-xs">
                    {parsedParticipants.filter(p => p.sponsorEmail).length} avec commanditaire renseigné
                  </div>
                )}
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
