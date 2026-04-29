import { RefObject } from "react";
import { PenLine, RefreshCw, UserPen } from "lucide-react";
import { Spinner } from "@/components/ui/spinner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatDateSlot, getPeriodLabel } from "@/lib/dateFormatters";
import type SignaturePad from "signature_pad";
import type { SignatureStatus } from "./types";

interface TrainerSignatureDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  signingSlot: { date: string; period: "AM" | "PM" } | null;
  setSigningSlot: (slot: { date: string; period: "AM" | "PM" } | null) => void;
  signatureStatuses?: SignatureStatus[];
  canvasRef: RefObject<HTMLCanvasElement>;
  signaturePadRef: RefObject<SignaturePad | null>;
  signaturePadReady: boolean;
  signatureInitError: boolean;
  savingTrainerSig: boolean;
  unsignedCount: number;
  onSaveSingle: () => Promise<void>;
  onSignAll: () => Promise<void>;
  onRetryInit: () => void;
}

const TrainerSignatureDialog = ({
  open,
  onOpenChange,
  signingSlot,
  setSigningSlot,
  signatureStatuses,
  canvasRef,
  signaturePadRef,
  signaturePadReady,
  signatureInitError,
  savingTrainerSig,
  unsignedCount,
  onSaveSingle,
  onSignAll,
  onRetryInit,
}: TrainerSignatureDialogProps) => {
  const slotInfo = signingSlot
    ? signatureStatuses?.find(s => s.date === signingSlot.date && s.period === signingSlot.period)
    : null;
  const timeRange = slotInfo
    ? ` (${slotInfo.startTime.replace(":", "h")} - ${slotInfo.endTime.replace(":", "h")})`
    : "";
  return (
  <Dialog open={open} onOpenChange={(o) => {
    if (!o) {
      onOpenChange(false);
      setSigningSlot(null);
    }
  }}>
    <DialogContent className="w-full sm:max-w-lg">
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <UserPen className="h-5 w-5" />
          Signature du formateur
        </DialogTitle>
        <DialogDescription>
          {signingSlot
            ? `Signez pour le ${formatDateSlot(signingSlot.date)} — ${getPeriodLabel(signingSlot.period)}${timeRange}`
            : `Signez pour toutes les demi-journées non signées (${unsignedCount})`
          }
        </DialogDescription>
      </DialogHeader>

      <div className="border rounded-lg overflow-hidden bg-white relative">
        <canvas
          ref={canvasRef}
          className="w-full"
          style={{ height: "180px", touchAction: "none" }}
        />
        {!signaturePadReady && !signatureInitError && (
          <div className="absolute inset-0 flex items-center justify-center bg-white/80">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Spinner />
              Initialisation de la zone de signature…
            </div>
          </div>
        )}
        {signatureInitError && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/90 gap-2">
            <p className="text-sm text-destructive">
              Impossible d'initialiser la zone de signature.
            </p>
            <Button size="sm" variant="outline" onClick={onRetryInit}>
              <RefreshCw className="h-4 w-4 mr-1" />
              Réessayer
            </Button>
          </div>
        )}
      </div>

      <DialogFooter className="flex-row justify-between sm:justify-between">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => signaturePadRef.current?.clear()}
          disabled={!signaturePadReady}
        >
          Effacer
        </Button>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => {
              onOpenChange(false);
              setSigningSlot(null);
            }}
          >
            Annuler
          </Button>
          <Button
            onClick={signingSlot ? onSaveSingle : onSignAll}
            disabled={savingTrainerSig || !signaturePadReady}
          >
            {savingTrainerSig ? (
              <Spinner className="mr-2" />
            ) : (
              <PenLine className="h-4 w-4 mr-2" />
            )}
            {signingSlot ? "Valider" : "Signer tout"}
          </Button>
        </div>
      </DialogFooter>
    </DialogContent>
  </Dialog>
);

export default TrainerSignatureDialog;
