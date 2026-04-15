import { Pencil, Loader2, Check, Copy } from "lucide-react";
import { useCopyToClipboard } from "@/hooks/useCopyToClipboard";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { FormationFormula } from "@/types/training";
import { useEditParticipant } from "@/hooks/useEditParticipant";
import type { Participant } from "@/hooks/useEditParticipant";
import { ParticipantFormFields, SponsorFormFields, ParticipantFiles } from "./edit-participant";
import { formatDateRange } from "@/lib/dateFormatters";

export type { Participant };

interface EditParticipantDialogProps {
  participant: Participant;
  trainingId: string;
  formatFormation?: string | null;
  isInterEntreprise?: boolean;
  trainingElearningDuration?: number | null;
  availableFormulas?: FormationFormula[];
  trainingDuree?: string;
  trainingDates?: [string | null, string | null];
  trainingLocation?: string | null;
  onParticipantUpdated: () => void;
}

const EditParticipantDialog = ({
  participant,
  trainingId,
  formatFormation,
  isInterEntreprise: isInterEntrepriseProp,
  trainingElearningDuration,
  availableFormulas = [],
  trainingDuree,
  trainingDates,
  trainingLocation,
  onParticipantUpdated,
}: EditParticipantDialogProps) => {
  const isInterEntreprise =
    isInterEntrepriseProp ??
    (formatFormation === "inter-entreprises" || formatFormation === "e_learning");

  const selectedFormula = availableFormulas.find(
    (f) => f.id === participant.formula_id,
  );
  const formulaAllowsCoaching =
    (selectedFormula?.coaching_sessions_count || 0) > 0;

  const hook = useEditParticipant({
    participant,
    trainingId,
    formatFormation,
    isInterEntreprise,
    trainingElearningDuration,
    availableFormulas,
    formulaAllowsCoaching,
    onParticipantUpdated,
  });

  return (
    <Dialog
      open={hook.open}
      onOpenChange={(isOpen) => {
        if (!isOpen) {
          hook.handleClose();
        } else {
          hook.setOpen(true);
        }
      }}
    >
      <Tooltip>
        <TooltipTrigger asChild>
          <DialogTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-muted-foreground hover:text-primary"
            >
              <Pencil className="h-4 w-4" />
            </Button>
          </DialogTrigger>
        </TooltipTrigger>
        <TooltipContent>
          <p>Modifier le participant</p>
        </TooltipContent>
      </Tooltip>
      <DialogContent className="max-h-[90vh] overflow-y-auto overflow-x-hidden w-full sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Modifier le participant</DialogTitle>
          <DialogDescription className="flex items-center gap-2">
            {hook.autoSaving ? (
              <>
                <Loader2 className="h-3 w-3 animate-spin" />
                Enregistrement...
              </>
            ) : hook.lastSaved ? (
              <>
                <Check className="h-3 w-3 text-green-600" />
                Sauvegardé
              </>
            ) : (
              "Modifiez les informations du participant."
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <ParticipantFormFields
            firstName={hook.firstName}
            setFirstName={hook.setFirstName}
            lastName={hook.lastName}
            setLastName={hook.setLastName}
            email={hook.email}
            setEmail={hook.setEmail}
            company={hook.company}
            setCompany={hook.setCompany}
            isInterEntreprise={isInterEntreprise}
            soldPriceHt={hook.soldPriceHt}
            setSoldPriceHt={hook.setSoldPriceHt}
            formula={hook.formula}
            setFormula={hook.setFormula}
            availableFormulas={availableFormulas}
            formatFormation={formatFormation}
            elearningDuration={hook.elearningDuration}
            setElearningDuration={hook.setElearningDuration}
            trainingElearningDuration={trainingElearningDuration}
            couponCode={hook.couponCode}
            formulaAllowsCoaching={formulaAllowsCoaching}
            coachingSessionsTotal={hook.coachingSessionsTotal}
            setCoachingSessionsTotal={hook.setCoachingSessionsTotal}
            selectedFormula={selectedFormula}
            coachingSessionsCompleted={
              participant.coaching_sessions_completed || 0
            }
            coachingDeadline={participant.coaching_deadline}
          />

          {isInterEntreprise && (
            <>
              <SponsorFormFields
                sponsorFirstName={hook.sponsorFirstName}
                setSponsorFirstName={hook.setSponsorFirstName}
                sponsorLastName={hook.sponsorLastName}
                setSponsorLastName={hook.setSponsorLastName}
                sponsorEmail={hook.sponsorEmail}
                setSponsorEmail={hook.setSponsorEmail}
                financeurSameAsSponsor={hook.financeurSameAsSponsor}
                setFinanceurSameAsSponsor={hook.setFinanceurSameAsSponsor}
                financeurName={hook.financeurName}
                setFinanceurName={hook.setFinanceurName}
                financeurUrl={hook.financeurUrl}
                setFinanceurUrl={hook.setFinanceurUrl}
                financeurPopoverOpen={hook.financeurPopoverOpen}
                setFinanceurPopoverOpen={hook.setFinanceurPopoverOpen}
                existingFinanceurs={hook.existingFinanceurs}
                paymentMode={hook.paymentMode}
                setPaymentMode={hook.setPaymentMode}
                notes={hook.notes}
                setNotes={hook.setNotes}
                signedConventionUrl={hook.signedConventionUrl}
                uploadingConvention={hook.uploadingConvention}
                conventionSignature={hook.conventionSignature}
                participantId={participant.id}
                handleConventionUpload={hook.handleConventionUpload}
                handleConventionDelete={hook.handleConventionDelete}
              />

              <ParticipantFiles
                participantId={participant.id}
                participantFiles={hook.participantFiles}
                uploadingFile={hook.uploadingFile}
                handleFileUpload={hook.handleFileUpload}
                handleDeleteFile={hook.handleDeleteFile}
              />
            </>
          )}
        </div>

        <div className="flex justify-between pt-4 border-t">
          {isInterEntreprise && trainingDuree && trainingDates ? (
            <CopyParticipantInfoButton
              firstName={hook.firstName}
              lastName={hook.lastName}
              duree={trainingDuree}
              dates={formatDateRange(trainingDates[0], trainingDates[1])}
              lieu={trainingLocation || ""}
            />
          ) : <div />}
          <Button type="button" variant="outline" onClick={hook.handleClose}>
            Fermer
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

function CopyParticipantInfoButton({
  firstName,
  lastName,
  duree,
  dates,
  lieu,
}: {
  firstName: string;
  lastName: string;
  duree: string;
  dates: string;
  lieu: string;
}) {
  const { copied, copy } = useCopyToClipboard();

  const handleCopy = () => {
    const participantName = [firstName, lastName].filter(Boolean).join(" ") || "—";
    const text = `Durée : ${duree}\nParticipants : ${participantName}\nDates : ${dates}\nLieu : ${lieu || "—"}`;
    copy(text);
  };

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button type="button" variant="outline" size="sm" onClick={handleCopy}>
          {copied ? <Check className="h-4 w-4 mr-1 text-green-600" /> : <Copy className="h-4 w-4 mr-1" />}
          {copied ? "Copié" : "Copier infos"}
        </Button>
      </TooltipTrigger>
      <TooltipContent>
        <p>Copier durée, participant, dates et lieu</p>
      </TooltipContent>
    </Tooltip>
  );
}

export default EditParticipantDialog;
