import { useState } from "react";
import { MapPin, ExternalLink, Mail, Loader2 } from "lucide-react";
import { toastError } from "@/lib/toastError";
import { Spinner } from "@/components/ui/spinner";
import { getGoogleMapsDirectionsUrl, getGoogleMapsSearchUrl } from "@/lib/googleMaps";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import ModuleLayout from "@/components/ModuleLayout";
import DuplicateTrainingDialog from "@/components/formations/DuplicateTrainingDialog";
import ThankYouEmailPreviewDialog from "@/components/formations/ThankYouEmailPreviewDialog";
import FormationDetailHeader from "@/components/formations/FormationDetailHeader";
import FormationDetailInfo from "@/components/formations/FormationDetailInfo";
import FormationDetailParticipants from "@/components/formations/FormationDetailParticipants";
import FormationDetailSections from "@/components/formations/FormationDetailSections";
import TrainingSurveyResults from "@/components/formations/TrainingSurveyResults";
import { useFormationDetail } from "@/hooks/useFormationDetail";
import { sendVenueBookingRequest } from "@/services/training-venues";
import { format, parseISO } from "date-fns";
import { fr } from "date-fns/locale";

const FormationDetail = () => {
  const fd = useFormationDetail();
  const [sendingVenueBooking, setSendingVenueBooking] = useState(false);

  const handleResendVenueBooking = async () => {
    if (!fd.training?.id) return;
    setSendingVenueBooking(true);
    try {
      await sendVenueBookingRequest(fd.training.id);
      fd.setTraining((t) => t ? { ...t, venue_booking_sent_at: new Date().toISOString() } : t);
      fd.toast({ title: "E-mail envoyé", description: "La demande de réservation a été envoyée au lieu." });
    } catch {
      toastError(fd.toast, "Impossible d'envoyer la demande de réservation.");
    } finally {
      setSendingVenueBooking(false);
    }
  };

  if (fd.loading) {
    return (
      <ModuleLayout>
        <div className="flex items-center justify-center py-20">
          <Spinner size="lg" className="text-primary" />
        </div>
      </ModuleLayout>
    );
  }

  if (!fd.training) return null;

  // BPF incomplet — détermine où l'utilisateur doit agir :
  // · Inter / e-learning : la source peut être renseignée sur la formation OU par
  //   participant. On flag les Participants si type_stagiaire manque, ou si la
  //   source manque sur la formation ET sur au moins un participant.
  // · Intra / classe virtuelle : la source est attendue au niveau de la formation,
  //   et le type de stagiaire reste par participant.
  const bpfIsInter =
    fd.isInterSession || fd.training.format_formation === "e_learning";
  const bpfTrainingMissingSource = !fd.training.source_financement_bpf;
  const bpfSomeMissingType = fd.participants.some((p) => !p.type_stagiaire_bpf);
  const bpfSomeMissingSource = fd.participants.some(
    (p) => !p.source_financement_bpf,
  );
  const bpfHasParticipants = fd.participants.length > 0;
  const bpfTrainingNeedsAttention =
    bpfHasParticipants && !bpfIsInter && bpfTrainingMissingSource;
  const bpfParticipantsNeedAttention =
    bpfHasParticipants &&
    (bpfSomeMissingType ||
      (bpfIsInter && bpfTrainingMissingSource && bpfSomeMissingSource));

  return (
    <ModuleLayout>
      <main className="max-w-7xl mx-auto p-3 md:p-6">
        <FormationDetailHeader
          training={fd.training}
          setTraining={fd.setTraining}
          schedules={fd.schedules}
          id={fd.id!}
          isMobile={fd.isMobile}
          isPresentiel={fd.isPresentiel}
          isInterSession={fd.isInterSession}
          formatDateWithSchedule={fd.formatDateWithSchedule}
          navigate={fd.navigate}
          toast={fd.toast}
          setMapDialogOpen={fd.setMapDialogOpen}
          setDuplicateDialogOpen={fd.setDuplicateDialogOpen}
          requiredEquipment={fd.catalogRequiredEquipment}
        />

        {/* Venue booking resend button — inter sessions with a venue */}
        {fd.isInterSession && fd.training.venue_id && (
          <div className="mb-4 flex items-center gap-3 rounded-lg border px-4 py-3 bg-muted/30 text-sm">
            <Mail className="h-4 w-4 shrink-0 text-muted-foreground" />
            <span className="flex-1 text-muted-foreground">
              {fd.training.venue_booking_sent_at
                ? `Demande de réservation envoyée le ${format(parseISO(fd.training.venue_booking_sent_at), "d MMMM yyyy", { locale: fr })}`
                : "Aucune demande de réservation envoyée"}
            </span>
            <Button
              size="sm"
              variant="outline"
              onClick={handleResendVenueBooking}
              disabled={sendingVenueBooking}
            >
              {sendingVenueBooking ? (
                <><Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />Envoi…</>
              ) : (
                <><Mail className="h-3.5 w-3.5 mr-1.5" />{fd.training.venue_booking_sent_at ? "Renvoyer" : "Envoyer"}</>
              )}
            </Button>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          <FormationDetailInfo
            training={fd.training}
            schedules={fd.schedules}
            participants={fd.participants}
            availableFormulas={fd.availableFormulas}
            assignedUserName={fd.assignedUserName}
            isInterSession={fd.isInterSession}
            getFormatLabel={fd.getFormatLabel}
            calculateTotalDuration={fd.calculateTotalDuration}
            bpfNeedsAttention={bpfTrainingNeedsAttention}
          />
          <FormationDetailParticipants
            training={fd.training}
            setTraining={fd.setTraining}
            participants={fd.participants}
            isInterSession={fd.isInterSession}
            availableFormulas={fd.availableFormulas}
            autoAddParticipantOpen={fd.autoAddParticipantOpen}
            setAutoAddParticipantOpen={fd.setAutoAddParticipantOpen}
            addParticipantData={fd.addParticipantData}
            setAddParticipantData={fd.setAddParticipantData}
            showThankYouPreview={fd.showThankYouPreview}
            setShowThankYouPreview={fd.setShowThankYouPreview}
            sendingThankYou={fd.sendingThankYou}
            thankYouSentAt={fd.thankYouSentAt}
            emailsRefreshTrigger={fd.emailsRefreshTrigger}
            setEmailsRefreshTrigger={fd.setEmailsRefreshTrigger}
            schedules={fd.schedules}
            calculateTotalDuration={fd.calculateTotalDuration}
            fetchParticipants={fd.fetchParticipants}
            bpfNeedsAttention={bpfParticipantsNeedAttention}
          />
        </div>

        <FormationDetailSections
          training={fd.training}
          setTraining={fd.setTraining}
          schedules={fd.schedules}
          participants={fd.participants}
          availableFormulas={fd.availableFormulas}
          isInterSession={fd.isInterSession}
          scheduledActions={fd.scheduledActions}
          setScheduledActions={fd.setScheduledActions}
          savingActions={fd.savingActions}
          notes={fd.notes}
          setNotes={fd.setNotes}
          savingNotes={fd.savingNotes}
          notesChanged={fd.notesChanged}
          setNotesChanged={fd.setNotesChanged}
          emailsRefreshTrigger={fd.emailsRefreshTrigger}
          id={fd.id!}
          thankYouSentAt={fd.thankYouSentAt}
          isElearningSession={fd.isElearningSession}
          hasCoaching={fd.availableFormulas.some(f => f.coaching_sessions_count > 0)}
          getSponsorName={fd.getSponsorName}
          calculateTotalDuration={fd.calculateTotalDuration}
          fetchTrainingData={fd.fetchTrainingData}
          handleSaveActions={fd.handleSaveActions}
          handleToggleActionComplete={fd.handleToggleActionComplete}
          handleSaveNotes={fd.handleSaveNotes}
          toast={fd.toast}
        />
      </main>

      {/* Map Dialog */}
      <Dialog open={fd.mapDialogOpen} onOpenChange={fd.setMapDialogOpen}>
        <DialogContent className="w-full sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MapPin className="h-5 w-5" />Localisation de la formation
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">{fd.training.location}</p>
            {fd.training.location ? (
              <div className="aspect-video w-full rounded-lg overflow-hidden border">
                <iframe
                  src={`https://www.google.com/maps?q=${encodeURIComponent(fd.training.location)}&output=embed`}
                  className="w-full h-full border-0"
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                  title="Carte de la formation"
                  allowFullScreen
                />
              </div>
            ) : null}
            <div className="flex justify-end">
              <Button variant="outline" asChild>
                <a href={getGoogleMapsDirectionsUrl(fd.training.location)} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="h-4 w-4 mr-2" />Itinéraire Google Maps
                </a>
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <DuplicateTrainingDialog
        open={fd.duplicateDialogOpen}
        onOpenChange={fd.setDuplicateDialogOpen}
        trainingId={fd.training.id}
        trainingName={fd.training.training_name}
        isElearning={fd.isElearningSession}
        userId={fd.user?.id || ""}
      />

      <ThankYouEmailPreviewDialog
        open={fd.showThankYouPreview}
        onOpenChange={fd.setShowThankYouPreview}
        trainingId={fd.training.id}
        trainingName={fd.training.training_name}
        supportsUrl={fd.training.supports_url?.trim() || null}
        onConfirmSend={fd.handleSendThankYouEmail}
        isSending={fd.sendingThankYou}
      />
    </ModuleLayout>
  );
};

export default FormationDetail;
