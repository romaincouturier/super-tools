import { useState } from "react";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { VoiceTextarea } from "@/components/ui/voice-textarea";
import { LossReason, lossReasonConfig } from "@/types/crm";
import { cn } from "@/lib/utils";

interface LossReasonDialogProps {
  open: boolean;
  onConfirm: (reason: LossReason, detail: string) => void;
  onCancel: () => void;
}

const LossReasonDialog = ({ open, onConfirm, onCancel }: LossReasonDialogProps) => {
  const [selectedReason, setSelectedReason] = useState<LossReason | null>(null);
  const [detail, setDetail] = useState("");

  const handleConfirm = () => {
    if (!selectedReason) return;
    onConfirm(selectedReason, detail.trim());
    setSelectedReason(null);
    setDetail("");
  };

  const handleCancel = () => {
    setSelectedReason(null);
    setDetail("");
    onCancel();
  };

  return (
    <AlertDialog open={open} onOpenChange={(o) => !o && handleCancel()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Pourquoi ce deal est perdu ?</AlertDialogTitle>
          <AlertDialogDescription>
            Cette information aide le coach commercial à identifier les patterns et améliorer la stratégie.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 my-4">
          {(Object.entries(lossReasonConfig) as [LossReason, string][]).map(([key, label]) => (
            <Button
              key={key}
              variant="outline"
              size="sm"
              className={cn(
                "justify-start text-left h-auto py-2",
                selectedReason === key && "border-red-500 bg-red-50 text-red-700"
              )}
              onClick={() => setSelectedReason(key)}
            >
              {label}
            </Button>
          ))}
        </div>

        {selectedReason && (
          <VoiceTextarea
            placeholder="Détails supplémentaires (optionnel)..."
            value={detail}
            onValueChange={setDetail}
            onChange={(e) => setDetail(e.target.value)}
            rows={2}
            className="resize-none"
          />
        )}

        <AlertDialogFooter>
          <Button variant="ghost" onClick={handleCancel}>
            Annuler
          </Button>
          <Button
            variant="destructive"
            onClick={handleConfirm}
            disabled={!selectedReason}
          >
            Confirmer la perte
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};

export default LossReasonDialog;
