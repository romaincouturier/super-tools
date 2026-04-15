import { Save, StickyNote, Euro, CheckCircle2 } from "lucide-react";
import { Spinner } from "@/components/ui/spinner";
import { toastError } from "@/lib/toastError";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { VoiceTextarea } from "@/components/ui/voice-textarea";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import DocumentsManager from "@/components/formations/DocumentsManager";
import EntityDocumentsManager from "@/components/shared/EntityDocumentsManager";
import ScheduledEmailsSummary from "@/components/formations/ScheduledEmailsSummary";
import EmailTimelineComputed from "@/components/formations/EmailTimelineComputed";
import ScheduledActionsEditor, { ScheduledAction } from "@/components/formations/ScheduledActionsEditor";
import AttendanceSignatureBlock from "@/components/formations/AttendanceSignatureBlock";
import TrainerAdequacy from "@/components/formations/TrainerAdequacy";
import TrainerEvaluationBlock from "@/components/formations/TrainerEvaluationBlock";
import ParticipantEvaluationsBlock from "@/components/formations/ParticipantEvaluationsBlock";
import EntityMediaManager from "@/components/media/EntityMediaManager";
import LiveMeetingsSection from "@/components/formations/LiveMeetingsSection";
import SupportEditor from "@/components/formations/support/SupportEditor";

import type { Training, Schedule, Participant } from "@/hooks/useFormationDetail";
import type { FormationFormula } from "@/types/training";

interface Props {
  training: Training;
  setTraining: (t: Training) => void;
  schedules: Schedule[];
  participants: Participant[];
  availableFormulas: FormationFormula[];
  isInterSession: boolean;
  scheduledActions: ScheduledAction[];
  setScheduledActions: (v: ScheduledAction[]) => void;
  savingActions: boolean;
  notes: string;
  setNotes: (v: string) => void;
  savingNotes: boolean;
  notesChanged: boolean;
  setNotesChanged: (v: boolean) => void;
  emailsRefreshTrigger: number;
  id: string;
  thankYouSentAt: string | null;
  isElearningSession: boolean;
  hasCoaching: boolean;
  getSponsorName: () => string | null;
  calculateTotalDuration: () => number;
  fetchTrainingData: () => Promise<void>;
  handleSaveActions: (actions: ScheduledAction[]) => Promise<void>;
  handleToggleActionComplete: (actionId: string, completed: boolean) => Promise<void>;
  handleSaveNotes: () => Promise<void>;
  toast: (opts: { title?: string; description?: string; variant?: "default" | "destructive" }) => void;
}

const FormationDetailSections = ({
  training,
  setTraining,
  schedules,
  participants,
  availableFormulas,
  isInterSession,
  scheduledActions,
  setScheduledActions,
  savingActions,
  notes,
  setNotes,
  savingNotes,
  notesChanged,
  setNotesChanged,
  emailsRefreshTrigger,
  id,
  thankYouSentAt,
  isElearningSession,
  hasCoaching,
  getSponsorName,
  calculateTotalDuration: _calculateTotalDuration,
  fetchTrainingData,
  handleSaveActions,
  handleToggleActionComplete,
  handleSaveNotes,
  toast,
}: Props) => (
  <>
    {/* Lives */}
    {availableFormulas.length >= 2 && (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <LiveMeetingsSection trainingId={training.id} />
      </div>
    )}

    {/* Documents + Scheduled Emails */}
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
      <div className="space-y-6">
        <DocumentsManager
          trainingId={training.id}
          trainingName={training.training_name}
          startDate={training.start_date}
          endDate={training.end_date}
          invoiceFileUrl={training.invoice_file_url}
          attendanceSheetsUrls={training.attendance_sheets_urls || []}
          sponsorEmail={training.sponsor_email}
          sponsorName={getSponsorName()}
          sponsorFirstName={training.sponsor_first_name}
          sponsorFormalAddress={training.sponsor_formal_address}
          supportsUrl={training.supports_url}
          evaluationLink={training.evaluation_link}
          formatFormation={training.format_formation}
          isInterEntreprise={isInterSession}
          conventionFileUrl={training.convention_file_url}
          trainerName={training.trainer_name}
          location={training.location}
          schedules={schedules}
          participants={participants}
          signedConventionUrls={training.signed_convention_urls || []}
          onUpdate={fetchTrainingData}
        />
        <EntityDocumentsManager entityType="training" entityId={id} title="Documents joints" />
      </div>
      <div className="space-y-6">
        <EmailTimelineComputed
          trainingId={training.id}
          participants={participants}
          refreshTrigger={emailsRefreshTrigger}
          trainingStartDate={training.start_date}
          trainingEndDate={training.end_date}
          sessionType={training.session_type || null}
          sessionFormat={training.session_format || null}
          formatFormation={training.format_formation}
          trainerName={training.trainer_name}
          sponsorName={getSponsorName()}
          sponsorEmail={training.sponsor_email}
          thankYouSentAt={thankYouSentAt}
          schedules={schedules}
          hasCoaching={hasCoaching}
          isElearning={isElearningSession}
        />
        <ScheduledEmailsSummary
          trainingId={training.id}
          participants={participants}
          refreshTrigger={emailsRefreshTrigger}
        />
      </div>
    </div>

    {/* Scheduled Actions + Attendance */}
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
      <ScheduledActionsEditor
        actions={scheduledActions}
        onActionsChange={setScheduledActions}
        onSave={() => handleSaveActions(scheduledActions)}
        saving={savingActions}
        onToggleComplete={handleToggleActionComplete}
        onDeleteSaved={async (actionId) => {
          try {
            await supabase.from("training_actions").delete().eq("id", actionId);
          } catch (error) {
            console.error("Error deleting action:", error);
            toastError(toast, "Impossible de supprimer l'action.");
          }
        }}
      />
      <AttendanceSignatureBlock
        trainingId={training.id}
        trainingName={training.training_name}
        trainerName={training.trainer_name}
        schedules={schedules}
        participantsCount={participants.length}
        participants={participants}
        location={training.location}
        startDate={training.start_date}
        endDate={training.end_date}
        onUpdate={fetchTrainingData}
      />
    </div>

    {/* Trainer Adequacy + Evaluation */}
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
      <TrainerAdequacy trainingId={training.id} trainerName={training.trainer_name} />
      <TrainerEvaluationBlock trainingId={training.id} trainerName={training.trainer_name} trainerId={(training as unknown as { trainer_id?: string | null }).trainer_id} />
    </div>

    {/* Participant Evaluations */}
    <div className="mb-6">
      <ParticipantEvaluationsBlock trainingId={training.id} />
    </div>

    {/* Photos & Videos */}
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
      <EntityMediaManager sourceType="training" sourceId={training.id} sourceLabel={training.training_name} />
    </div>

    {/* Support de formation */}
    <div className="mb-6">
      <SupportEditor trainingId={training.id} trainingName={training.training_name} />
    </div>

    {/* Funder Appreciation + Notes */}
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Euro className="h-5 w-5" />Appréciation financeur
            <span className="text-sm font-normal text-muted-foreground">(Indicateur 30)</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <VoiceTextarea
            placeholder="Retour du financeur (OPCO, France Travail…) sur cette formation..."
            value={(training as unknown as { funder_appreciation?: string | null }).funder_appreciation || ""}
            onValueChange={(v) => setTraining({ ...training, funder_appreciation: v } as Training)}
            onChange={(e) => setTraining({ ...training, funder_appreciation: e.target.value } as Training)}
            onBlur={async () => {
              const val = ((training as unknown as { funder_appreciation?: string | null }).funder_appreciation || "").trim();
              await supabase.from("trainings").update({ funder_appreciation: val || null, funder_appreciation_date: val ? new Date().toISOString().split("T")[0] : null }).eq("id", training.id);
            }}
            className="min-h-[80px] resize-y"
          />
          {(training as unknown as { funder_appreciation_date?: string | null }).funder_appreciation_date && (
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <CheckCircle2 className="h-3 w-3 text-primary" />
              Renseigné le {new Date((training as unknown as { funder_appreciation_date?: string }).funder_appreciation_date!).toLocaleDateString("fr-FR")}
            </p>
          )}
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <StickyNote className="h-5 w-5" />Notes
            </CardTitle>
            {notesChanged && (
              <Button size="sm" onClick={handleSaveNotes} disabled={savingNotes}>
                {savingNotes ? <Spinner className="mr-2" /> : <Save className="h-4 w-4 mr-2" />}
                Enregistrer
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <VoiceTextarea
            placeholder="Ajoutez des notes libres sur cette formation..."
            value={notes}
            onValueChange={(v) => { setNotes(v); setNotesChanged(true); }}
            onChange={(e) => { setNotes(e.target.value); setNotesChanged(true); }}
            onBlur={() => { if (notesChanged) handleSaveNotes(); }}
            className="min-h-[120px] resize-y"
          />
        </CardContent>
      </Card>
    </div>
  </>
);

export default FormationDetailSections;
