import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { GraduationCap } from "lucide-react";

interface CreateTrainingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  opportunityTitle: string;
}

export function CreateTrainingDialog({
  open,
  onOpenChange,
  onConfirm,
  opportunityTitle,
}: CreateTrainingDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 rounded-full bg-primary/10 text-primary">
              <GraduationCap className="h-5 w-5" />
            </div>
            <AlertDialogTitle>Créer une formation ?</AlertDialogTitle>
          </div>
          <AlertDialogDescription className="text-left">
            L'opportunité <strong>"{opportunityTitle}"</strong> a été marquée comme gagnée.
            <br /><br />
            Voulez-vous créer une formation à partir de cette opportunité ? Les informations seront préremplies automatiquement.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Non, plus tard</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm}>
            Oui, créer la formation
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
