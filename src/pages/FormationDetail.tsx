import { Loader2, MapPin, ExternalLink } from "lucide-react";
import { getGoogleMapsEmbedUrl, getGoogleMapsDirectionsUrl } from "@/lib/googleMaps";
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
import { useFormationDetail } from "@/hooks/useFormationDetail";

const FormationDetail = () => {
  const fd = useFormationDetail();

  if (fd.loading) {
    return (
      <ModuleLayout>
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </ModuleLayout>
    );
  }

  if (!fd.training) return null;

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

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          <FormationDetailInfo
            training={fd.training}
            schedules={fd.schedules}
            participants={fd.participants}
            availableFormulas={fd.availableFormulas}
            assignedUserName={fd.assignedUserName}
            isInterSession={fd.isInterSession}
            copiedEmail={fd.copiedEmail}
            setCopiedEmail={fd.setCopiedEmail}
            copiedLocation={fd.copiedLocation}
            setCopiedLocation={fd.setCopiedLocation}
            getFormatLabel={fd.getFormatLabel}
            calculateTotalDuration={fd.calculateTotalDuration}
            toast={fd.toast}
          />
          <FormationDetailParticipants
            training={fd.training}
            setTraining={fd.setTraining}
            participants={fd.participants}
            isInterSession={fd.isInterSession}
            availableFormulas={fd.availableFormulas}
            copiedParticipantEmails={fd.copiedParticipantEmails}
            setCopiedParticipantEmails={fd.setCopiedParticipantEmails}
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
            toast={fd.toast}
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
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MapPin className="h-5 w-5" />Localisation de la formation
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">{fd.training.location}</p>
            <div className="aspect-video w-full rounded-lg overflow-hidden border">
              <iframe
                width="100%" height="100%" style={{ border: 0 }} loading="lazy" allowFullScreen
                referrerPolicy="no-referrer-when-downgrade"
                src={getGoogleMapsEmbedUrl(fd.training.location, fd.googleMapsApiKey)}
              />
            </div>
            <div className="flex justify-end gap-2">
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
