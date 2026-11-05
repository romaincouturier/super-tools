import { useState, useEffect, useMemo } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { FormationFormula } from "@/types/training";
import { Users, AlertCircle, AlertTriangle } from "lucide-react";
import { Spinner } from "@/components/ui/spinner";
import { isManualEmailMode, isTrainingOngoing } from "@/lib/emailScheduling";
import { differenceInDays, parseISO } from "date-fns";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { toastError } from "@/lib/toastError";
import { useParticipantParser } from "@/hooks/useParticipantParser";
import { getErrorMessage } from "@/lib/error-utils";
import { insertParticipantsWithQuestionnaires, sendWelcomeEmailsToBatch, enqueueElearningAccessBatch, watchElearningAccessBatch, buildAccessReportMessage, scheduleNeedsSurveyEmails, logBulkAddActivity, buildStatusMessage } from "@/services/bulkParticipants";
import { catchUpAttendanceSignaturesForParticipant } from "@/services/participants";
import { scheduleTrainerSummaryIfNeeded } from "@/lib/workingDays";
import { supabase } from "@/integrations/supabase/client";
import { useDemoMode } from "@/contexts/DemoModeContext";
import { maskEmail } from "@/lib/demoMask";

interface BulkAddParticipantsDialogProps {
  trainingId: string;
  trainingStartDate?: string;
  trainingEndDate?: string | null;
  onParticipantsAdded: () => void;
  onScheduledEmailsRefresh?: () => void;
  isInterEntreprise?: boolean;
  isFreeTraining?: boolean;
  formatFormation?: string | null;
  availableFormulas?: FormationFormula[];
  trainingFormulaId?: string;
}

const pluralize = (count: number) => (count !== 1 ? "s" : "");

const BulkAddParticipantsDialog = ({
  trainingId, trainingStartDate, trainingEndDate, onParticipantsAdded, onScheduledEmailsRefresh, isInterEntreprise = false, isFreeTraining = false, formatFormation, availableFormulas = [], trainingFormulaId,
}: BulkAddParticipantsDialogProps) => {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [progress, setProgress] = useState({ value: 0, action: "", detail: "" });
  const [bulkText, setBulkText] = useState("");
  const [isManualMode, setIsManualMode] = useState(false);
  const { toast } = useToast();
  const { isDemoMode } = useDemoMode();
  const { parsedParticipants, parseErrors } = useParticipantParser(bulkText, isInterEntreprise);
  const count = parsedParticipants.length;
  const showFormulas = availableFormulas.length >= 2 && !trainingFormulaId;
  const [defaultFormulaId, setDefaultFormulaId] = useState("");
  const [formulaOverrides, setFormulaOverrides] = useState<Record<string, string>>({});
  const [showPerParticipant, setShowPerParticipant] = useState(false);
  const formulaIdFor = (email: string) => formulaOverrides[email.trim().toLowerCase()] || defaultFormulaId;
  const missingFormula = showFormulas && parsedParticipants.some((p) => !formulaIdFor(p.email));
  const formulaLabel = (f: FormationFormula) => `${f.name}${f.prix != null ? ` — ${f.prix}€` : ""}`; // demo-safe: tarif du catalogue SuperTilt
  const overrideCount = useMemo(
    () => parsedParticipants.filter((p) => { const o = formulaOverrides[p.email.trim().toLowerCase()]; return o && o !== defaultFormulaId; }).length,
    [parsedParticipants, formulaOverrides, defaultFormulaId],
  );

  useEffect(() => {
    if (trainingStartDate) setIsManualMode(isManualEmailMode(trainingStartDate));
  }, [trainingStartDate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving) return;
    if (count === 0) {
      toastError(toast, "Veuillez entrer au moins une adresse email valide.", { title: "Aucun participant" });
      return;
    }
    if (missingFormula) {
      toastError(toast, "Choisissez une formule pour tous les participants.", { title: "Formule manquante" });
      return;
    }
    setSaving(true);
    setProgress({ value: 0, action: "Ajout des participants et préparation des questionnaires…", detail: `${count} participant${pluralize(count)} à ajouter` });
    try {
      const { data, status, sendWelcomeNow, duplicateWarning } = await insertParticipantsWithQuestionnaires(parsedParticipants, trainingId, trainingStartDate, showFormulas ? (email) => availableFormulas.find((f) => f.id === formulaIdFor(email)) : undefined);
      const insertedCount = data?.length ?? 0;
      setProgress({ value: 25, action: "Participants ajoutés", detail: `${insertedCount} participant${pluralize(insertedCount)} ajouté${pluralize(insertedCount)}` });
      if (duplicateWarning) toast({ title: "Doublons détectés", description: "Certains participants étaient déjà inscrits et ont été ignorés.", variant: "default" });
      const ongoing = isTrainingOngoing(trainingStartDate, trainingEndDate);
      let accessFailures: { email: string; message: string }[] = [];
      let accessSummary = "";
      // Même règle que l'ajout unitaire (getEmailMode) : convocation tout de suite
      // si la session est à 2 jours ou plus, ou déjà en cours (ajout en cours de
      // session). Sans date, la réconciliation l'enverra quand la date sera fixée ;
      // à moins de 2 jours, l'envoi reste manuel.
      if (!isFreeTraining && (sendWelcomeNow || ongoing) && data && data.length > 0 && formatFormation !== "e_learning") {
        setProgress({ value: 25, action: "Envoi des emails d’accueil…", detail: `0 / ${data.length} participants traités` });
        await sendWelcomeEmailsToBatch(data, trainingId, (completed, total) => {
          setProgress({ value: 25 + (completed / total) * 45, action: "Envoi des emails d’accueil…", detail: `${completed} / ${total} participants traités` });
        });
      }
      if (formatFormation === "e_learning" && data && data.length > 0) {
        setProgress({ value: 40, action: "Programmation des emails d’accès e-learning…", detail: `${data.length} participants` });
        const { batchId, total } = await enqueueElearningAccessBatch(data, trainingId);
        accessSummary = `${total} email${pluralize(total)} d’accès en cours d’envoi en arrière-plan : vous pouvez fermer la page.`;
        void watchElearningAccessBatch(batchId).then((final) => {
          const summary = buildAccessReportMessage(final);
          toast({
            title: final.failures.length > 0 ? "Emails d’accès terminés, avec des échecs" : "Emails d’accès envoyés",
            ...(final.failures.length > 0 && { variant: "destructive" as const, duration: 15000 }),
            description: `${summary}${final.failures.length > 0 ? ` ${final.failures.length} échec${pluralize(final.failures.length)} : ${final.failures.map((f) => `${isDemoMode ? maskEmail(f.email) : f.email} : ${isDemoMode ? "Envoi échoué" : f.message}`).join(" ; ")}` : ""}`,
          });
        });
      }
      let needsSurveySkipped = false;
      // Needs survey only makes sense before the session starts.
      const trainingInFuture = status !== "non_envoye" && !ongoing;
      if (trainingInFuture && data && data.length > 0 && trainingStartDate && formatFormation !== "e_learning") {
        setProgress({ value: 70, action: "Programmation des recueils des besoins…", detail: `${insertedCount} participants ajoutés` });
        needsSurveySkipped = await scheduleNeedsSurveyEmails(data, trainingId, trainingStartDate);
      }
      if (trainingStartDate && status !== "non_envoye") {
        setProgress({ value: 80, action: "Programmation du récapitulatif formateur…", detail: `${insertedCount} participants ajoutés` });
        await scheduleTrainerSummaryIfNeeded(supabase, trainingId, trainingStartDate);
      }
      // Mid-session catch-up : send attendance signature email to each new
      // participant for slots that were already sent to existing participants.
      let attendanceCatchUpSlots = 0;
      if (ongoing && data && data.length > 0 && formatFormation !== "e_learning") {
        setProgress({ value: 85, action: "Rattrapage des demandes d’émargement…", detail: `${insertedCount} participants ajoutés` });
        const results = await Promise.all(
          data.map((p) => catchUpAttendanceSignaturesForParticipant(trainingId, p.id).catch(() => ({ sentSlots: 0, errors: 1 }))),
        );
        attendanceCatchUpSlots = results.reduce((acc, r) => acc + r.sentSlots, 0);
      }
      if (data && data.length > 0) {
        setProgress({ value: 95, action: "Finalisation de l’ajout…", detail: `${insertedCount} participants ajoutés` });
        await logBulkAddActivity(data, trainingId, isInterEntreprise);
      }
      setProgress({ value: 100, action: "Ajout terminé", detail: `${insertedCount} participants ajoutés` });
      const n = data?.length || 0;
      const baseMessage = accessFailures.length > 0
        ? `${accessFailures.length} email${pluralize(accessFailures.length)} d’accès non envoyé${pluralize(accessFailures.length)}. ${accessFailures.map((failure) => `${isDemoMode ? maskEmail(failure.email) : failure.email} : ${isDemoMode ? "Envoi échoué" : failure.message}`).join(" ; ")} Les inscriptions sont conservées ; renvoyez uniquement les accès en échec.`
        : isFreeTraining
        ? formatFormation === "e_learning"
          ? "Formation gratuite — accès e-learning envoyé."
          : "Formation gratuite — aucune convocation ni convention envoyée."
        : ongoing
        ? `Formation en cours — mail d'accueil envoyé${attendanceCatchUpSlots > 0 ? `, ${attendanceCatchUpSlots} demande${pluralize(attendanceCatchUpSlots)} d'émargement rattrapée${pluralize(attendanceCatchUpSlots)}` : ""}.`
        : buildStatusMessage(status, sendWelcomeNow, needsSurveySkipped);
      toast({
        title: accessFailures.length > 0 ? "Participants ajoutés, emails d’accès en échec" : "Participants ajoutés",
        ...(accessFailures.length > 0 && { variant: "destructive" as const, duration: 15000 }),
        description: `${n} participant${pluralize(n)} ajouté${pluralize(n)}. ${accessSummary ? `${accessSummary} ` : ""}${baseMessage}`,
        ...(needsSurveySkipped && { duration: 8000 }),
      });
      setBulkText("");
      setOpen(false);
      onParticipantsAdded();
      onScheduledEmailsRefresh?.();
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
    <Dialog open={open} onOpenChange={(nextOpen) => { if (!saving) setOpen(nextOpen); }}>
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
              <Textarea id="bulkText" value={bulkText} onChange={(e) => setBulkText(e.target.value)} disabled={saving} placeholder={placeholder} rows={8} className="font-mono text-sm" />
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
            {showFormulas && (
              <div className="space-y-2">
                <Label>Formule pour tous les participants</Label>
                <Select value={defaultFormulaId} onValueChange={setDefaultFormulaId} disabled={saving}>
                  <SelectTrigger aria-label="Formule pour tous les participants"><SelectValue placeholder="Sélectionner une formule" /></SelectTrigger>
                  <SelectContent>
                    {availableFormulas.map((f) => <SelectItem key={f.id} value={f.id}>{formulaLabel(f)}</SelectItem>)}
                  </SelectContent>
                </Select>
                {count > 0 && (
                  <Button type="button" variant="link" className="h-auto p-0 text-sm" disabled={saving} onClick={() => setShowPerParticipant((v) => !v)}>
                    {showPerParticipant ? "Masquer le choix par participant" : "Choisir une formule différente pour certains participants"}
                    {overrideCount > 0 && ` (${overrideCount} personnalisée${pluralize(overrideCount)})`}
                  </Button>
                )}
                {showPerParticipant && count > 0 && (
                  <div className="max-h-64 overflow-y-auto rounded-md border divide-y">
                    {parsedParticipants.map((p) => {
                      const key = p.email.trim().toLowerCase();
                      const name = [p.firstName, p.lastName].filter(Boolean).join(" ");
                      return (
                        <div key={key} className="flex items-center gap-2 p-2 text-sm">
                          <span className="min-w-0 flex-1 truncate">{name || (isDemoMode ? maskEmail(p.email) : p.email)}</span>
                          <Select value={formulaIdFor(p.email)} onValueChange={(v) => setFormulaOverrides((prev) => ({ ...prev, [key]: v }))} disabled={saving}>
                            <SelectTrigger className="w-56" aria-label={`Formule de ${name || "ce participant"}`}><SelectValue placeholder="Formule" /></SelectTrigger>
                            <SelectContent>
                              {availableFormulas.map((f) => <SelectItem key={f.id} value={f.id}>{formulaLabel(f)}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
          {saving && (
            <div className="space-y-2 pb-4" role="status" aria-live="polite" aria-atomic="true">
              <div className="flex items-start gap-2 text-sm font-medium">
                <Spinner className="mt-0.5 shrink-0" />
                <span className="min-w-0 break-words">{progress.action}</span>
              </div>
              <Progress value={progress.value} aria-label="Progression de l’ajout des participants" aria-valuenow={progress.value} aria-valuemin={0} aria-valuemax={100} className="h-2" />
              <p className="text-sm text-muted-foreground">{progress.detail}</p>
            </div>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" disabled={saving} onClick={() => setOpen(false)}>Annuler</Button>
            <Button type="submit" disabled={saving || count === 0 || missingFormula}>
              {saving ? <><Spinner className="mr-2" />Ajout...</> : `Ajouter ${count} participant${pluralize(count)}`}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default BulkAddParticipantsDialog;
