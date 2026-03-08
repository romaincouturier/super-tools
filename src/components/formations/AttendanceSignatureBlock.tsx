/**
 * AttendanceSignatureBlock — Orchestrator
 *
 * Delegates to:
 * - useAttendanceSignatures (state + handlers)
 * - AttendanceSlotList (slot table UI)
 * - TrainerSignatureDialog (trainer sign dialog)
 * - exportAttendancePdf (PDF generation)
 */
import { Loader2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { useAttendanceSignatures } from "./attendance/useAttendanceSignatures";
import { exportAttendancePdf } from "./attendance/attendancePdfExport";
import AttendanceSlotList from "./attendance/AttendanceSlotList";
import TrainerSignatureDialog from "./attendance/TrainerSignatureDialog";
import type { AttendanceSignatureBlockProps } from "./attendance/types";

const AttendanceSignatureBlock = (props: AttendanceSignatureBlockProps) => {
  const ctx = useAttendanceSignatures({
    trainingId: props.trainingId,
    trainingName: props.trainingName,
    trainerName: props.trainerName,
    schedules: props.schedules,
    participantsCount: props.participantsCount,
    onUpdate: props.onUpdate,
  });

  const handleExportPdf = async (participantId?: string) => {
    ctx.setExporting(true);
    try {
      const result = await exportAttendancePdf({
        trainingId: props.trainingId,
        trainingName: props.trainingName,
        startDate: props.startDate,
        participantId,
        onUpdate: props.onUpdate,
      });
      ctx.toast({
        title: result.success ? (participantId ? "PDF exporté" : "Feuille d'émargement générée") : "Aucune donnée",
        description: result.message,
        variant: result.success ? undefined : "destructive",
      });
    } catch (err) {
      console.error("Error exporting attendance PDF:", err);
      ctx.toast({
        title: "Erreur",
        description: "Une erreur est survenue lors de l'export.",
        variant: "destructive",
      });
    } finally {
      ctx.setExporting(false);
    }
  };

  if (!ctx.shouldShowBlock() || ctx.loading) {
    if (ctx.loading) {
      return (
        <Card>
          <CardContent className="py-6">
            <Loader2 className="h-5 w-5 animate-spin mx-auto" />
          </CardContent>
        </Card>
      );
    }
    return null;
  }

  if (ctx.signatureStatuses.length === 0) return null;

  return (
    <>
      <AttendanceSlotList
        signatureStatuses={ctx.signatureStatuses}
        participantsCount={props.participantsCount}
        participants={props.participants}
        sendingSlot={ctx.sendingSlot}
        exporting={ctx.exporting}
        totalExpected={ctx.totalExpected}
        totalSigned={ctx.totalSigned}
        totalTrainerSigned={ctx.totalTrainerSigned}
        hasUnsignedTrainerSlots={ctx.hasUnsignedTrainerSlots}
        onSend={ctx.handleSendSignatureRequests}
        onOpenTrainerSign={ctx.openTrainerSignDialog}
        onSignAllTrainer={() => {
          ctx.setSigningSlot(null);
          ctx.setShowTrainerSignDialog(true);
        }}
        onExportPdf={handleExportPdf}
      />

      <TrainerSignatureDialog
        open={ctx.showTrainerSignDialog}
        onOpenChange={ctx.setShowTrainerSignDialog}
        signingSlot={ctx.signingSlot}
        setSigningSlot={ctx.setSigningSlot}
        canvasRef={ctx.canvasRef as any}
        signaturePadRef={ctx.signaturePadRef as any}
        signaturePadReady={ctx.signaturePadReady}
        signatureInitError={ctx.signatureInitError}
        savingTrainerSig={ctx.savingTrainerSig}
        unsignedCount={ctx.signatureStatuses.filter(s => !s.trainerSigned).length}
        onSaveSingle={ctx.handleSaveTrainerSignature}
        onSignAll={ctx.handleSignAllSlots}
        onRetryInit={() => ctx.initSignaturePad()}
      />
    </>
  );
};

export default AttendanceSignatureBlock;
