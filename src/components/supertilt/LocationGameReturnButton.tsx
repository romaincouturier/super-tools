import { PackageCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { useLocationGameReturn } from "@/hooks/useLocationGameReturn";
import { useConfirm } from "@/hooks/useConfirm";
import { useToast } from "@/hooks/use-toast";
import { toastError } from "@/lib/toastError";

export default function LocationGameReturnButton({ id }: { id: string }) {
  const { mutateAsync, isPending } = useLocationGameReturn();
  const { confirm, ConfirmDialog } = useConfirm();
  const { toast } = useToast();

  const handleReturn = async () => {
    if (isPending) return;
    if (!await confirm({
      title: "Confirmer le retour du jeu ?",
      description: "Le jeu a été reçu. La date de retour sera enregistrée et la carte passera dans les commandes traitées, même avant l’échéance de location.",
      confirmText: "Confirmer le retour",
      variant: "default",
    })) return;
    try {
      await mutateAsync(id);
      toast({ title: "Retour du jeu enregistré" });
    } catch (error) {
      toastError(toast, error, { title: "Le retour n’a pas pu être enregistré" });
    }
  };

  return <>
    <Button variant="outline" size="sm" className="h-6 text-xs px-2" onClick={handleReturn} disabled={isPending}>
      {isPending ? <Spinner className="h-3 w-3 mr-1" /> : <PackageCheck className="h-3 w-3 mr-1" />}
      Jeu revenu
    </Button>
    <ConfirmDialog />
  </>;
}