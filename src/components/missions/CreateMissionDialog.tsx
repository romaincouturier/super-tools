import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { MissionStatus } from "@/types/missions";
import { useCreateMission } from "@/hooks/useMissions";

const createMissionSchema = z.object({
  title: z.string().min(1, "Le titre est requis").trim(),
  clientName: z.string().trim().optional(),
  clientContact: z.string().trim().optional(),
  totalAmount: z.string().optional(),
});

type CreateMissionFormValues = z.infer<typeof createMissionSchema>;

interface CreateMissionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultStatus?: MissionStatus;
  prefillTitle?: string;
  prefillClientName?: string;
  prefillClientContact?: string;
  prefillTotalAmount?: string;
}

const CreateMissionDialog = ({
  open,
  onOpenChange,
  defaultStatus = "not_started",
  prefillTitle,
  prefillClientName,
  prefillClientContact,
  prefillTotalAmount,
}: CreateMissionDialogProps) => {
  const createMission = useCreateMission();

  const form = useForm<CreateMissionFormValues>({
    resolver: zodResolver(createMissionSchema),
    defaultValues: {
      title: "",
      clientName: "",
      clientContact: "",
      totalAmount: "",
    },
  });

  useEffect(() => {
    if (open) {
      form.reset({
        title: prefillTitle || "",
        clientName: prefillClientName || "",
        clientContact: prefillClientContact || "",
        totalAmount: prefillTotalAmount || "",
      });
    }
  }, [open, prefillTitle, prefillClientName, prefillClientContact, prefillTotalAmount]);

  const onSubmit = async (values: CreateMissionFormValues) => {
    try {
      await createMission.mutateAsync({
        title: values.title,
        client_name: values.clientName || undefined,
        client_contact: values.clientContact || undefined,
        initial_amount: values.totalAmount ? parseFloat(values.totalAmount) || undefined : undefined,
        status: defaultStatus,
      });

      form.reset();
      onOpenChange(false);
    } catch (error) {
      console.error("Erreur création mission:", error);
      toast({
        title: "Erreur",
        description: "Impossible de créer la mission. Veuillez réessayer.",
        variant: "destructive",
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nouvelle mission</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Titre de la mission</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="Ex: Développement application mobile" autoFocus />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="clientName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Entreprise</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="Nom de l'entreprise" />
                  </FormControl>
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="clientContact"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Contact (nom, email...)</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="Ex: Jean Dupont jean@exemple.com" />
                  </FormControl>
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="totalAmount"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Montant initial (€)</FormLabel>
                  <FormControl>
                    <Input type="number" min="0" step="0.01" {...field} placeholder="0" />
                  </FormControl>
                </FormItem>
              )}
            />
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Annuler
              </Button>
              <Button type="submit" disabled={!form.formState.isValid || createMission.isPending}>
                {createMission.isPending ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : null}
                Créer
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};

export default CreateMissionDialog;
