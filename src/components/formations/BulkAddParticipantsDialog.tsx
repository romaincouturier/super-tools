import { useState, useEffect } from "react";
import { Users, AlertCircle, AlertTriangle } from "lucide-react";
import { Spinner } from "@/components/ui/spinner";
import { isManualEmailMode, isTrainingOngoing } from "@/lib/emailScheduling";
import { differenceInDays, parseISO } from "date-fns";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { toastError } from "@/lib/toastError";
import { useParticipantParser } from "@/hooks/useParticipantParser";
import { getErrorMessage } from "@/lib/error-utils";
import { insertParticipantsWithQuestionnaires, sendWelcomeEmailsToBatch, sendElearningAccessToBatch, scheduleNeedsSurveyEmails, logBulkAddActivity, buildStatusMessage } from "@/services/bulkParticipants";
import { catchUpAttendanceSignaturesForParticipant } from "@/services/participants";
import { scheduleTrainerSummaryIfNeeded } from "@/lib/workingDays";
import { supabase } from "@/integrations/supabase/client";

interface BulkAddParticipantsDialogProps {
  trainingId: string;
  trainingStartDate?: string;
  trainingEndDate?: string | null;
  onParticipantsAdded: () => void;
  isInterEntreprise?: boolean;
  formatFormation?: string | null;
}

const pluralize = (count: number) => (count !== 1 ? "s" : "");

const BulkAddParticipantsDialog = ({
  trainingId, trainingStartDate, trainingEndDate, onParticipantsAdded, isInterEntreprise = false, formatFormation,
}: BulkAddParticipantsDialogProps) => {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [bulkText, setBulkText] = useState("");
  const [isManualMode, setIsManualMode] = useState(false);
  const { toast } = useToast();
  const { parsedParticipants, parseErrors } = useParticipantParser(bulkText, isInterEntreprise);
  const count = parsedParticipants.length;

  useEffect(() => {
    if (trainingStartDate) setIsManualMode(isManualEmailMode(trainingStartDate));
  }, [trainingStartDate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (count === 0) {
      toastError(toast, "Veuillez entrer au moins une adresse email valide.", { title: "Aucun participant" });
      return;
    }
    setSaving(true);
    try {
      const { data, status, sendWelcomeNow, duplicateWarning } = await insertParticipantsWithQuestionnaires(parsedParticipants, trainingId, trainingStartDate);
      if (duplicateWarning) toast({ title: "Doublons détectés", description: "Certains participants étaient déjà inscrits et ont été ignorés.", variant: "default" });
      const ongoing = isTrainingOngoing(trainingStartDate, trainingEndDate);
      // Send welcome email when training is future (existing behaviour) OR ongoing
      // (mid-session add: participants still need convocation / classe virtuelle link).
      if ((status !== "non_envoye" || ongoing) && data && data.length > 0 && formatFormation !== "e_learning") {
        await sendWelcomeEmailsToBatch(data, trainingId);
      }
      if (formatFormation === "e_learning" && data && data.length > 0) await sendElearningAccessToBatch(data, trainingId);
      let needsSurveySkipped = false;
      // Needs survey only makes sense before the session starts.
      const trainingInFuture = status !== "non_envoye" && !ongoing;
      if (trainingInFuture && data && data.length > 0 && trainingStartDate && formatFormation !== "e_learning") {
        needsSurveySkipped = await scheduleNeedsSurveyEmails(data, trainingId, trainingStartDate);
      }
      if (trainingStartDate && status !== "non_envoye") await scheduleTrainerSummaryIfNeeded(supabase, trainingId, trainingStartDate);
      // Mid-session catch-up : send attendance signature email to each new
      // participant for slots that were already sent to existing participants.
      let attendanceCatchUpSlots = 0;
      if (ongoing && data && data.length > 0 && formatFormation !== "e_learning") {
        const results = await Promise.all(
          data.map((p) => catchUpAttendanceSignaturesForParticipant(trainingId, p.id).catch(() => ({ sentSlots: 0, errors: 1 }))),
        );
        attendanceCatchUpSlots = results.reduce((acc, r) => acc + r.sentSlots, 0);
      }
      if (data && data.length > 0) await logBulkAddActivity(data, trainingId, isInterEntreprise);
      const n = data?.length || 0;
      const baseMessage = ongoing
        ? `Formation en cours — mail d'accueil envoyé${attendanceCatchUpSlots > 0 ? `, ${attendanceCatchUpSlots} demande${pluralize(attendanceCatchUpSlots)} d'émargement rattrapée${pluralize(attendanceCatchUpSlots)}` : ""}.`
        : buildStatusMessage(status, sendWelcomeNow, needsSurveySkipped);
      toast({
        title: "Participants ajoutés",
        description: `${n} participant${pluralize(n)} ajouté${pluralize(n)}. ${baseMessage}`,
        ...(needsSurveySkipped && { duration: 8000 }),
      });
      setBulkText("");
      setOpen(false);
      onParticipantsAdded();
    } catch (error: unknown) {
      console.error("Error adding participants:", error);
      toastError(toast, getErrorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  const placeholder = isInterEntreprise
    ? "jean.dupont@example.com, ACME Corp | Marie Sponsor marie.sponsor@acme.com\nPierre Martin pierre.martin@test.fr, Tech SA | sponsor@tech.fr"
    : "jean.dupont@example.com\nMarie Martin marie.martin@example.com, ACME Corp";

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline"><Users className="h-4 w-4 mr-2" />Ajout en lot</Button>
      </DialogTrigger>
      <DialogContent className="w-full sm:max-w-2xl">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>
              Ajouter plusieurs participants
              {isInterEntreprise && <span className="ml-2 text-sm font-normal text-muted-foreground">(Inter-entreprises)</span>}
            </DialogTitle>
            <DialogDescription>
              {isInterEntreprise ? (
                <>
                  Entrez les participants, un par ligne. Format inter-entreprises :<br />
                  {"\u2022 Prénom Nom email, Société | Prénom_Cmd Nom_Cmd email_cmd"}<br />
                  {"\u2022 email, Société | email_commanditaire"}<br />
                  <span className="text-muted-foreground text-xs">Le symbole | sépare les infos du participant de celles du commanditaire</span>
                </>
              ) : (
                <>
                  Entrez les participants, un par ligne. Formats acceptés :<br />
                  {"\u2022 email@example.com"}<br />{"\u2022 Prénom Nom email@example.com, Société"}
                </>
              )}
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
              <Textarea id="bulkText" value={bulkText} onChange={(e) => setBulkText(e.target.value)} placeholder={placeholder} rows={8} className="font-mono text-sm" />
            </div>
            {parseErrors.length > 0 && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{parseErrors.map((err, i) => <div key={i}>{err}</div>)}</AlertDescription>
              </Alert>
            )}
            {count > 0 && (
              <div className="text-sm text-muted-foreground space-y-1">
                <div>{count} participant{pluralize(count)} détecté{pluralize(count)}</div>
                {isInterEntreprise && <div className="text-xs">{parsedParticipants.filter((p) => p.sponsorEmail).length} avec commanditaire renseigné</div>}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Annuler</Button>
            <Button type="submit" disabled={saving || count === 0}>
              {saving ? <><Spinner className="mr-2" />Ajout...</> : `Ajouter ${count} participant${pluralize(count)}`}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default BulkAddParticipantsDialog;
