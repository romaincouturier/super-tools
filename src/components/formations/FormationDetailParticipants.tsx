import { Users, Copy, Check, Clock, Heart, Send, CheckCircle2, AlertTriangle, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { format, parseISO, isToday, isBefore, startOfDay } from "date-fns";
import { fr } from "date-fns/locale";
import ParticipantList from "@/components/formations/ParticipantList";
import AddParticipantDialog from "@/components/formations/AddParticipantDialog";
import BulkAddParticipantsDialog from "@/components/formations/BulkAddParticipantsDialog";
import NeedsSurveySummaryDialog from "@/components/formations/NeedsSurveySummaryDialog";
import type { Training, Participant } from "@/hooks/useFormationDetail";
import type { FormationFormula } from "@/types/training";

interface Props {
  training: Training;
  setTraining: (t: Training) => void;
  participants: Participant[];
  isInterSession: boolean;
  availableFormulas: FormationFormula[];
  copiedParticipantEmails: boolean;
  setCopiedParticipantEmails: (v: boolean) => void;
  autoAddParticipantOpen: boolean;
  setAutoAddParticipantOpen: (v: boolean) => void;
  addParticipantData: { firstName?: string; lastName?: string; email?: string; company?: string; soldPriceHt?: string } | null;
  setAddParticipantData: (v: { firstName?: string; lastName?: string; email?: string; company?: string; soldPriceHt?: string } | null) => void;
  showThankYouPreview: boolean;
  setShowThankYouPreview: (v: boolean) => void;
  sendingThankYou: boolean;
  thankYouSentAt: string | null;
  emailsRefreshTrigger: number;
  setEmailsRefreshTrigger: (fn: (v: number) => number) => void;
  schedules: { id: string; day_date: string; start_time: string; end_time: string }[];
  calculateTotalDuration: () => number;
  fetchParticipants: () => Promise<void>;
  toast: (opts: { title?: string; description?: string; variant?: "default" | "destructive" }) => void;
}

const FormationDetailParticipants = ({
  training,
  setTraining,
  participants,
  isInterSession,
  availableFormulas,
  copiedParticipantEmails,
  setCopiedParticipantEmails,
  autoAddParticipantOpen,
  setAutoAddParticipantOpen,
  addParticipantData,
  setAddParticipantData,
  showThankYouPreview,
  setShowThankYouPreview,
  sendingThankYou,
  thankYouSentAt,
  emailsRefreshTrigger,
  setEmailsRefreshTrigger,
  schedules,
  calculateTotalDuration,
  fetchParticipants,
  toast,
}: Props) => {
  const effectiveEndDate = training.end_date || training.start_date;
  const endDate = effectiveEndDate ? parseISO(effectiveEndDate) : null;
  const isLastDayOrAfter = !endDate || isToday(endDate) || isBefore(endDate, startOfDay(new Date()));
  const hasSupportsUrl = !!training.supports_url?.trim();
  const canSend = isLastDayOrAfter && hasSupportsUrl && participants.length > 0;

  return (
    <Card>
      <CardHeader className="px-3 md:px-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-2">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />Participants
            </CardTitle>
            <CardDescription className="flex items-center gap-1.5">
              {participants.length} participant{participants.length !== 1 ? "s" : ""} inscrit{participants.length !== 1 ? "s" : ""}
              {participants.length > 0 && (
                <button type="button" className="p-0.5 rounded hover:bg-muted transition-colors" title="Copier tous les emails" onClick={() => {
                  const emailList = participants.map((p) => { const name = [p.first_name, p.last_name].filter(Boolean).join(" "); return name ? `${name} <${p.email}>` : p.email; }).join(", ");
                  navigator.clipboard.writeText(emailList);
                  setCopiedParticipantEmails(true);
                  toast({ title: "Emails copiés", description: `${participants.length} adresse${participants.length > 1 ? "s" : ""} copiée${participants.length > 1 ? "s" : ""} pour Gmail.` });
                  setTimeout(() => setCopiedParticipantEmails(false), 2000);
                }}>
                  {copiedParticipantEmails ? <Check className="h-3.5 w-3.5 text-primary" /> : <Copy className="h-3.5 w-3.5 text-muted-foreground hover:text-foreground" />}
                </button>
              )}
            </CardDescription>
          </div>
          <div className="flex items-center gap-3 md:gap-4">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <span>Tu</span>
              <Switch
                checked={training.participants_formal_address}
                onCheckedChange={async (checked) => {
                  const { error } = await supabase.from("trainings").update({ participants_formal_address: checked }).eq("id", training.id);
                  if (!error) setTraining({ ...training, participants_formal_address: checked });
                }}
                className="scale-75"
              />
              <span>Vous</span>
            </div>
            <div className="flex gap-2">
              <BulkAddParticipantsDialog
                trainingId={training.id}
                trainingStartDate={training.start_date}
                onParticipantsAdded={fetchParticipants}
                isInterEntreprise={isInterSession}
                formatFormation={training.format_formation}
              />
              <AddParticipantDialog
                trainingId={training.id}
                trainingStartDate={training.start_date}
                clientName={training.client_name}
                formatFormation={training.format_formation}
                isInterEntreprise={isInterSession}
                availableFormulas={availableFormulas}
                trainingFormulaId={(training as unknown as { formula_id?: string | null }).formula_id ?? undefined}
                onParticipantAdded={fetchParticipants}
                onScheduledEmailsRefresh={() => setEmailsRefreshTrigger(prev => prev + 1)}
                initialFirstName={addParticipantData?.firstName}
                initialLastName={addParticipantData?.lastName}
                initialEmail={addParticipantData?.email}
                initialCompany={addParticipantData?.company}
                initialSoldPriceHt={addParticipantData?.soldPriceHt}
                externalOpen={autoAddParticipantOpen}
                onExternalOpenChange={(open) => { setAutoAddParticipantOpen(open); if (!open) setAddParticipantData(null); }}
              />
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4 px-3 md:px-6">
        <ParticipantList
          participants={participants}
          trainingId={training.id}
          trainingName={training.training_name}
          trainingStartDate={training.start_date}
          trainingEndDate={training.end_date}
          formatFormation={training.format_formation}
          isInterEntreprise={isInterSession}
          elearningDuration={training.elearning_duration}
          availableFormulas={availableFormulas}
          attendanceSheetsUrls={training.attendance_sheets_urls}
          clientName={training.client_name}
          trainingDuree={`${calculateTotalDuration()}h`}
          onParticipantUpdated={fetchParticipants}
        />

        <NeedsSurveySummaryDialog
          trainingId={training.id}
          trainingName={training.training_name}
          completedCount={participants.filter(p => p.needs_survey_status === "complete").length}
        />

        {/* Thank You Email Section */}
        <div className="pt-4 border-t space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex flex-col gap-1">
              <span className="text-sm font-medium flex items-center gap-2">
                <Heart className="h-4 w-4" />Mail de remerciement
              </span>
              {thankYouSentAt && (
                <span className="text-xs text-muted-foreground flex items-center gap-1">
                  <CheckCircle2 className="h-3 w-3 text-primary" />
                  Envoyé le {format(parseISO(thankYouSentAt), "d MMMM yyyy 'à' HH:mm", { locale: fr })}
                </span>
              )}
            </div>
            <Button type="button" variant="outline" size="sm" onClick={() => setShowThankYouPreview(true)} disabled={sendingThankYou || !canSend}>
              {sendingThankYou ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Send className="h-4 w-4 mr-2" />}
              Envoyer
            </Button>
          </div>
          {!hasSupportsUrl && (
            <p className="text-xs text-destructive flex items-center gap-1">
              <AlertTriangle className="h-3 w-3" />Un support de formation doit être renseigné avant l'envoi
            </p>
          )}
          {!isLastDayOrAfter && endDate && (
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <Clock className="h-3 w-3" />Disponible à partir du {format(endDate, "d MMMM yyyy", { locale: fr })} (dernier jour de formation)
            </p>
          )}
          <p className="text-xs text-muted-foreground">
            L'envoi programme automatiquement les emails post-formation (avis Google, témoignage vidéo, évaluation à froid, relances)
          </p>
        </div>
      </CardContent>
    </Card>
  );
};

export default FormationDetailParticipants;
