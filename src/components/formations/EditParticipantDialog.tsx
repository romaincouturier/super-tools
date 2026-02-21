import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Pencil, Loader2, FileText, Upload, Trash2, ExternalLink, CheckCircle2, Download, Paperclip, StickyNote } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Check, ChevronsUpDown } from "lucide-react";
import { cn, capitalizeName } from "@/lib/utils";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";

const editParticipantSchema = z.object({
  firstName: z.string().default(""),
  lastName: z.string().default(""),
  email: z.string().min(1, "L'email est requis").email("Email invalide"),
  company: z.string().default(""),
  sponsorFirstName: z.string().default(""),
  sponsorLastName: z.string().default(""),
  sponsorEmail: z.string().default(""),
  financeurSameAsSponsor: z.boolean().default(true),
  financeurName: z.string().default(""),
  financeurUrl: z.string().default(""),
  paymentMode: z.enum(["online", "invoice"]).default("invoice"),
  soldPriceHt: z.string().default(""),
  elearningDuration: z.string().default(""),
  notes: z.string().default(""),
});

type EditParticipantFormValues = z.infer<typeof editParticipantSchema>;

interface ParticipantFile {
  id: string;
  file_url: string;
  file_name: string;
  uploaded_at: string;
}

interface Participant {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string;
  company: string | null;
  sponsor_first_name?: string | null;
  sponsor_last_name?: string | null;
  sponsor_email?: string | null;
  financeur_same_as_sponsor?: boolean;
  financeur_name?: string | null;
  financeur_url?: string | null;
  payment_mode?: string;
  sold_price_ht?: number | null;
  signed_convention_url?: string | null;
  elearning_duration?: number | null;
  notes?: string | null;
}

interface ConventionSignatureStatus {
  signed_pdf_url: string | null;
  signed_at: string | null;
  status: string;
}

interface EditParticipantDialogProps {
  participant: Participant;
  trainingId: string;
  formatFormation?: string | null;
  trainingElearningDuration?: number | null;
  onParticipantUpdated: () => void;
}

// capitalizeName imported from @/lib/utils

const EditParticipantDialog = ({
  participant,
  trainingId,
  formatFormation,
  trainingElearningDuration,
  onParticipantUpdated,
}: EditParticipantDialogProps) => {
  const [open, setOpen] = useState(false);
  const [financeurPopoverOpen, setFinanceurPopoverOpen] = useState(false);
  const [existingFinanceurs, setExistingFinanceurs] = useState<string[]>([]);
  const [signedConventionUrl, setSignedConventionUrl] = useState(participant.signed_convention_url || null);
  const [uploadingConvention, setUploadingConvention] = useState(false);
  const [conventionSignature, setConventionSignature] = useState<ConventionSignatureStatus | null>(null);
  const [participantFiles, setParticipantFiles] = useState<ParticipantFile[]>([]);
  const [uploadingFile, setUploadingFile] = useState(false);
  const { toast } = useToast();

  const form = useForm<EditParticipantFormValues>({
    resolver: zodResolver(editParticipantSchema),
    defaultValues: {
      firstName: participant.first_name || "",
      lastName: participant.last_name || "",
      email: participant.email,
      company: participant.company || "",
      sponsorFirstName: participant.sponsor_first_name || "",
      sponsorLastName: participant.sponsor_last_name || "",
      sponsorEmail: participant.sponsor_email || "",
      financeurSameAsSponsor: participant.financeur_same_as_sponsor ?? true,
      financeurName: participant.financeur_name || "",
      financeurUrl: participant.financeur_url || "",
      paymentMode: (participant.payment_mode as "online" | "invoice") || "invoice",
      soldPriceHt: participant.sold_price_ht != null ? String(participant.sold_price_ht) : "",
      elearningDuration: participant.elearning_duration != null ? String(participant.elearning_duration) : (trainingElearningDuration != null ? String(trainingElearningDuration) : ""),
      notes: participant.notes || "",
    },
  });

  const { register, handleSubmit, watch, setValue, reset, formState: { isSubmitting, errors } } = form;
  const financeurSameAsSponsor = watch("financeurSameAsSponsor");
  const financeurName = watch("financeurName");
  const paymentMode = watch("paymentMode");

  const isInterEntreprise = formatFormation === "inter-entreprises" || formatFormation === "e_learning";

  // Reset form values when participant changes
  useEffect(() => {
    reset({
      firstName: participant.first_name || "",
      lastName: participant.last_name || "",
      email: participant.email,
      company: participant.company || "",
      sponsorFirstName: participant.sponsor_first_name || "",
      sponsorLastName: participant.sponsor_last_name || "",
      sponsorEmail: participant.sponsor_email || "",
      financeurSameAsSponsor: participant.financeur_same_as_sponsor ?? true,
      financeurName: participant.financeur_name || "",
      financeurUrl: participant.financeur_url || "",
      paymentMode: (participant.payment_mode as "online" | "invoice") || "invoice",
      soldPriceHt: participant.sold_price_ht != null ? String(participant.sold_price_ht) : "",
      elearningDuration: participant.elearning_duration != null ? String(participant.elearning_duration) : (trainingElearningDuration != null ? String(trainingElearningDuration) : ""),
      notes: participant.notes || "",
    });
    setSignedConventionUrl(participant.signed_convention_url || null);
  }, [participant, trainingElearningDuration]);

  // Fetch electronic convention signature status
  useEffect(() => {
    const fetchConventionSignature = async () => {
      if (!participant.sponsor_email) return;
      
      const { data } = await supabase
        .from("convention_signatures")
        .select("signed_pdf_url, signed_at, status")
        .eq("training_id", trainingId)
        .eq("recipient_email", participant.sponsor_email)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      
      if (data) {
        setConventionSignature(data);
      }
    };

    if (open && isInterEntreprise) {
      fetchConventionSignature();
    }
  }, [open, isInterEntreprise, trainingId, participant.sponsor_email]);

  // Fetch participant files when dialog opens
  useEffect(() => {
    const fetchFiles = async () => {
      const { data, error } = await (supabase as any)
        .from("participant_files")
        .select("id, file_url, file_name, uploaded_at")
        .eq("participant_id", participant.id)
        .order("uploaded_at", { ascending: false });

      if (!error && data) {
        setParticipantFiles(data);
      }
    };

    if (open && isInterEntreprise) {
      fetchFiles();
    }
  }, [open, isInterEntreprise, participant.id]);

  // Fetch existing funders when dialog opens
  useEffect(() => {
    const fetchFinanceurs = async () => {
      const [fromTrainings, fromParticipants] = await Promise.all([
        supabase
          .from("trainings")
          .select("financeur_name")
          .not("financeur_name", "is", null)
          .not("financeur_name", "eq", ""),
        supabase
          .from("training_participants")
          .select("financeur_name")
          .not("financeur_name", "is", null)
          .not("financeur_name", "eq", ""),
      ]);

      const allNames = new Set<string>();
      (fromTrainings.data || []).forEach((r) => r.financeur_name && allNames.add(r.financeur_name));
      (fromParticipants.data || []).forEach((r) => r.financeur_name && allNames.add(r.financeur_name));
      setExistingFinanceurs(Array.from(allNames).sort());
    };

    if (open && isInterEntreprise) {
      fetchFinanceurs();
    }
  }, [open, isInterEntreprise]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploadingFile(true);
    const uploadedFiles: ParticipantFile[] = [];
    let errorCount = 0;

    try {
      for (const file of Array.from(files)) {
        try {
          const sanitized = file.name
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .replace(/[^a-zA-Z0-9_.-]/g, "_");
          const path = `${trainingId}/participant_${participant.id}/fichier_${Date.now()}_${sanitized}`;

          const { error: uploadErr } = await supabase.storage
            .from("training-documents")
            .upload(path, file);
          if (uploadErr) throw uploadErr;

          const {
            data: { publicUrl },
          } = supabase.storage.from("training-documents").getPublicUrl(path);

          const { data: insertedFile, error: insertErr } = await (supabase as any)
            .from("participant_files")
            .insert({
              participant_id: participant.id,
              file_url: publicUrl,
              file_name: file.name,
            })
            .select("id, file_url, file_name, uploaded_at")
            .single();

          if (insertErr) throw insertErr;
          uploadedFiles.push(insertedFile);
        } catch (err) {
          console.error(`File upload error for ${file.name}:`, err);
          errorCount++;
        }
      }

      if (uploadedFiles.length > 0) {
        setParticipantFiles((prev) => [...uploadedFiles, ...prev]);
        toast({
          title: `${uploadedFiles.length} fichier${uploadedFiles.length > 1 ? "s" : ""} ajouté${uploadedFiles.length > 1 ? "s" : ""}`,
          ...(errorCount > 0 && { description: `${errorCount} fichier${errorCount > 1 ? "s" : ""} en erreur.`, variant: "destructive" as const }),
        });
      } else if (errorCount > 0) {
        toast({ title: "Erreur d'upload", description: "Aucun fichier n'a pu être uploadé.", variant: "destructive" });
      }
    } finally {
      setUploadingFile(false);
      e.target.value = "";
    }
  };

  const handleDeleteFile = async (fileToDelete: ParticipantFile) => {
    try {
      const urlParts = fileToDelete.file_url.split("/training-documents/");
      if (urlParts.length > 1) {
        await supabase.storage.from("training-documents").remove([urlParts[1]]);
      }

      await (supabase as any)
        .from("participant_files")
        .delete()
        .eq("id", fileToDelete.id);

      setParticipantFiles((prev) => prev.filter((f) => f.id !== fileToDelete.id));
      toast({ title: "Fichier supprimé" });
    } catch (err) {
      console.error("Delete file error:", err);
      toast({
        title: "Erreur",
        description: "Impossible de supprimer le fichier.",
        variant: "destructive",
      });
    }
  };

  const onSubmit = async (data: EditParticipantFormValues) => {
    try {
      const updateData: Record<string, unknown> = {
        first_name: capitalizeName(data.firstName) || null,
        last_name: capitalizeName(data.lastName) || null,
        email: data.email.trim().toLowerCase(),
        company: data.company.trim() || null,
      };

      if (isInterEntreprise) {
        updateData.notes = data.notes.trim() || null;
        updateData.sponsor_first_name = data.sponsorFirstName.trim() || null;
        updateData.sponsor_last_name = data.sponsorLastName.trim() || null;
        updateData.sponsor_email = data.sponsorEmail.trim().toLowerCase() || null;
        updateData.financeur_same_as_sponsor = data.financeurSameAsSponsor;
        updateData.financeur_name = !data.financeurSameAsSponsor ? (data.financeurName.trim() || null) : null;
        updateData.financeur_url = !data.financeurSameAsSponsor ? (data.financeurUrl.trim() || null) : null;
        updateData.payment_mode = data.paymentMode;
        updateData.sold_price_ht = data.soldPriceHt ? parseFloat(data.soldPriceHt) : null;
        if (formatFormation === "e_learning") {
          updateData.elearning_duration = data.elearningDuration ? parseFloat(data.elearningDuration) : null;
        }
      }

      const { error } = await supabase
        .from("training_participants")
        .update(updateData)
        .eq("id", participant.id);

      if (error) {
        if (error.code === "23505") {
          toast({
            title: "Email en double",
            description: "Un autre participant avec cet email est déjà inscrit à cette formation.",
            variant: "destructive",
          });
        } else {
          throw error;
        }
        return;
      }

      await supabase
        .from("training_evaluations")
        .update({
          email: data.email.trim().toLowerCase(),
          first_name: capitalizeName(data.firstName) || null,
          last_name: capitalizeName(data.lastName) || null,
          company: data.company.trim() || null,
        })
        .eq("participant_id", participant.id);

      await supabase.from("activity_logs").insert({
        action_type: "participant_updated",
        recipient_email: data.email.trim().toLowerCase(),
        details: {
          training_id: trainingId,
          participant_id: participant.id,
          participant_name: `${data.firstName.trim() || ""} ${data.lastName.trim() || ""}`.trim() || null,
          changes: {
            email_changed: data.email.trim().toLowerCase() !== participant.email,
          },
        },
      });

      toast({
        title: "Participant mis à jour",
        description: `Les informations de ${data.email} ont été mises à jour.`,
      });

      setOpen(false);
      onParticipantUpdated();
    } catch (error: unknown) {
      console.error("Error updating participant:", error);
      toast({
        title: "Erreur",
        description: error instanceof Error ? error.message : "Une erreur est survenue.",
        variant: "destructive",
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
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
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <form onSubmit={handleSubmit(onSubmit)} id="edit-participant-form">
          <DialogHeader>
            <DialogTitle>Modifier le participant</DialogTitle>
            <DialogDescription>
              Modifiez les informations du participant. Seul l'email est obligatoire.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit-firstName">Prénom</Label>
                <Input id="edit-firstName" {...register("firstName")} placeholder="Jean" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-lastName">Nom</Label>
                <Input id="edit-lastName" {...register("lastName")} placeholder="Dupont" />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-email">Email *</Label>
              <Input id="edit-email" type="email" {...register("email")} placeholder="jean.dupont@example.com" />
              {errors.email && <p className="text-sm text-destructive">{errors.email.message}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-company">Société</Label>
              <Input id="edit-company" {...register("company")} placeholder="ACME Corp" />
            </div>

            {/* Inter-enterprise specific fields */}
            {isInterEntreprise && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="edit-soldPriceHt">Montant vendu HT (€)</Label>
                  <Input id="edit-soldPriceHt" type="number" step="0.01" min="0" {...register("soldPriceHt")} placeholder="1500.00" />
                </div>

                {formatFormation === "e_learning" && (
                  <div className="space-y-2">
                    <Label htmlFor="edit-elearningDuration">Durée e-learning (heures)</Label>
                    <Input
                      id="edit-elearningDuration"
                      type="number"
                      step="0.5"
                      min="0"
                      {...register("elearningDuration")}
                      placeholder={trainingElearningDuration != null ? String(trainingElearningDuration) : "7"}
                    />
                    <p className="text-xs text-muted-foreground">
                      Par défaut : {trainingElearningDuration ?? 7}h (durée de la formation)
                    </p>
                  </div>
                )}

                {/* Sponsor/Commanditaire fields */}
                <div className="pt-4 border-t">
                  <Label className="text-sm font-medium text-muted-foreground">
                    Commanditaire (facturation)
                  </Label>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="edit-sponsorFirstName">Prénom</Label>
                    <Input id="edit-sponsorFirstName" {...register("sponsorFirstName")} placeholder="Marie" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="edit-sponsorLastName">Nom</Label>
                    <Input id="edit-sponsorLastName" {...register("sponsorLastName")} placeholder="Martin" />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-sponsorEmail">Email du commanditaire</Label>
                  <Input id="edit-sponsorEmail" type="email" {...register("sponsorEmail")} placeholder="marie.martin@example.com" />
                </div>

                {/* Funder section for inter-enterprise */}
                <div className="pt-4 border-t">
                  <Label className="text-sm font-medium text-muted-foreground">Financeur</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="edit-financeurSameAsSponsor"
                    checked={financeurSameAsSponsor}
                    onCheckedChange={(checked) => setValue("financeurSameAsSponsor", checked === true)}
                  />
                  <Label
                    htmlFor="edit-financeurSameAsSponsor"
                    className="text-sm font-normal cursor-pointer"
                  >
                    Le financeur est identique au commanditaire
                  </Label>
                </div>
                {!financeurSameAsSponsor && (
                  <>
                    <div className="space-y-2">
                      <Label htmlFor="edit-financeurName">Nom du financeur</Label>
                      <Popover open={financeurPopoverOpen} onOpenChange={setFinanceurPopoverOpen}>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            role="combobox"
                            aria-expanded={financeurPopoverOpen}
                            className="w-full justify-between font-normal"
                          >
                            {financeurName || "Sélectionner ou saisir un financeur..."}
                            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-full p-0" align="start">
                          <Command>
                            <CommandInput
                              placeholder="Rechercher ou saisir un financeur..."
                              value={financeurName}
                              onValueChange={(v) => setValue("financeurName", v)}
                            />
                            <CommandList>
                              <CommandEmpty>
                                <div className="p-2 text-sm text-muted-foreground">
                                  Appuyez sur Entrée pour utiliser "{financeurName}"
                                </div>
                              </CommandEmpty>
                              <CommandGroup>
                                {existingFinanceurs.map((f) => (
                                  <CommandItem
                                    key={f}
                                    value={f}
                                    onSelect={(value) => {
                                      setValue("financeurName", value);
                                      setFinanceurPopoverOpen(false);
                                    }}
                                  >
                                    <Check
                                      className={cn(
                                        "mr-2 h-4 w-4",
                                        financeurName === f ? "opacity-100" : "opacity-0"
                                      )}
                                    />
                                    {f}
                                  </CommandItem>
                                ))}
                              </CommandGroup>
                            </CommandList>
                          </Command>
                        </PopoverContent>
                      </Popover>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="edit-financeurUrl">URL du financeur</Label>
                      <Input id="edit-financeurUrl" type="url" {...register("financeurUrl")} placeholder="https://..." />
                    </div>
                  </>
                )}

                {/* Payment mode */}
                <div className="pt-4 border-t">
                  <Label className="text-sm font-medium text-muted-foreground">
                    Mode de paiement
                  </Label>
                </div>
                <RadioGroup
                  value={paymentMode}
                  onValueChange={(v) => setValue("paymentMode", v as "online" | "invoice")}
                  className="flex gap-4"
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="online" id="edit-paymentOnline" />
                    <Label htmlFor="edit-paymentOnline" className="font-normal cursor-pointer">
                      Payé en ligne
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="invoice" id="edit-paymentInvoice" />
                    <Label htmlFor="edit-paymentInvoice" className="font-normal cursor-pointer">
                      À facturer
                    </Label>
                  </div>
                </RadioGroup>

                {/* Convention signée section */}
                <div className="pt-4 border-t">
                  <Label className="text-sm font-medium text-muted-foreground">
                    Convention signée
                  </Label>
                </div>

                {/* Electronic signature status */}
                {conventionSignature?.status === "signed" && conventionSignature.signed_pdf_url && (
                  <div className="flex items-center gap-3 p-3 bg-green-50 dark:bg-green-950/30 rounded-lg border border-green-200 dark:border-green-800">
                    <CheckCircle2 className="h-5 w-5 text-green-600 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-green-800 dark:text-green-200">Signée électroniquement</p>
                      {conventionSignature.signed_at && (
                        <p className="text-xs text-green-600 dark:text-green-400">
                          le {new Date(conventionSignature.signed_at).toLocaleDateString("fr-FR")}
                        </p>
                      )}
                    </div>
                    <a
                      href={conventionSignature.signed_pdf_url}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <Button type="button" variant="outline" size="sm">
                        <ExternalLink className="h-4 w-4 mr-1" />
                        Voir
                      </Button>
                    </a>
                  </div>
                )}

                {conventionSignature?.status === "pending" && !signedConventionUrl && (
                  <div className="flex items-center gap-3 p-3 bg-amber-50 dark:bg-amber-950/30 rounded-lg border border-amber-200 dark:border-amber-800">
                    <Loader2 className="h-5 w-5 text-amber-600 animate-spin flex-shrink-0" />
                    <p className="text-sm text-amber-800 dark:text-amber-200">En attente de signature électronique</p>
                  </div>
                )}

                {/* Manual upload for signed convention */}
                <div className="space-y-2">
                  <Label className="text-sm flex items-center gap-2">
                    <FileText className="h-4 w-4" />
                    Convention signée (upload manuel)
                  </Label>
                  
                  {signedConventionUrl ? (
                    <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                      <FileText className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                      <button
                        type="button"
                        className="flex-1 text-sm text-primary hover:underline truncate text-left"
                        onClick={async () => {
                          try {
                            const response = await fetch(signedConventionUrl);
                            const blob = await response.blob();
                            const url = window.URL.createObjectURL(blob);
                            const a = document.createElement("a");
                            a.href = url;
                            a.download = "convention_signee.pdf";
                            document.body.appendChild(a);
                            a.click();
                            document.body.removeChild(a);
                            window.URL.revokeObjectURL(url);
                          } catch {
                            window.open(signedConventionUrl, "_blank");
                          }
                        }}
                      >
                        <Download className="h-3 w-3 inline mr-1" />
                        Télécharger la convention signée
                      </button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Supprimer la convention signée ?</AlertDialogTitle>
                            <AlertDialogDescription>
                              Cette action est irréversible.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Annuler</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={async () => {
                                try {
                                  const urlParts = signedConventionUrl.split("/training-documents/");
                                  if (urlParts.length > 1) {
                                    await supabase.storage.from("training-documents").remove([urlParts[1]]);
                                  }
                                  await supabase
                                    .from("training_participants")
                                    .update({ signed_convention_url: null } as Record<string, unknown>)
                                    .eq("id", participant.id);
                                  setSignedConventionUrl(null);
                                  onParticipantUpdated();
                                  toast({ title: "Convention supprimée" });
                                } catch (err) {
                                  console.error(err);
                                  toast({ title: "Erreur", description: "Impossible de supprimer.", variant: "destructive" });
                                }
                              }}
                              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            >
                              Supprimer
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  ) : (
                    <Label htmlFor={`signed-convention-${participant.id}`} className="cursor-pointer">
                      <input
                        id={`signed-convention-${participant.id}`}
                        type="file"
                        accept=".pdf"
                        className="hidden"
                        disabled={uploadingConvention}
                        onChange={async (e) => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          if (!file.type.includes("pdf")) {
                            toast({ title: "Format non supporté", description: "Seuls les fichiers PDF sont acceptés.", variant: "destructive" });
                            return;
                          }
                          setUploadingConvention(true);
                          try {
                            const sanitized = file.name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9_.-]/g, "_");
                            const path = `${trainingId}/participant_${participant.id}/convention_signee_${Date.now()}_${sanitized}`;
                            const { error: uploadErr } = await supabase.storage.from("training-documents").upload(path, file);
                            if (uploadErr) throw uploadErr;
                            const { data: { publicUrl } } = supabase.storage.from("training-documents").getPublicUrl(path);
                            await supabase
                              .from("training_participants")
                              .update({ signed_convention_url: publicUrl } as Record<string, unknown>)
                              .eq("id", participant.id);
                            setSignedConventionUrl(publicUrl);
                            onParticipantUpdated();
                            toast({ title: "Convention uploadée" });
                          } catch (err) {
                            console.error(err);
                            toast({ title: "Erreur d'upload", description: err instanceof Error ? err.message : "Erreur.", variant: "destructive" });
                          } finally {
                            setUploadingConvention(false);
                          }
                        }}
                      />
                      <Button type="button" variant="outline" size="sm" disabled={uploadingConvention} asChild>
                        <span>
                          {uploadingConvention ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Upload className="h-4 w-4 mr-2" />}
                          Uploader une convention signée
                        </span>
                      </Button>
                    </Label>
                  )}
                </div>

                {/* Notes libres */}
                <div className="pt-4 border-t">
                  <Label className="text-sm font-medium text-muted-foreground flex items-center gap-1">
                    <StickyNote className="h-4 w-4" />
                    Notes
                  </Label>
                </div>
                <div className="space-y-2">
                  <Textarea
                    {...register("notes")}
                    placeholder="Notes libres sur ce participant..."
                    rows={3}
                  />
                </div>

                {/* Fichiers libres */}
                <div className="pt-4 border-t">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm font-medium text-muted-foreground flex items-center gap-1">
                      <Paperclip className="h-4 w-4" />
                      Fichiers joints ({participantFiles.length})
                    </Label>
                    <Label htmlFor={`participant-file-${participant.id}`} className="cursor-pointer">
                      <input
                        id={`participant-file-${participant.id}`}
                        type="file"
                        multiple
                        className="hidden"
                        disabled={uploadingFile}
                        onChange={handleFileUpload}
                      />
                      <Button type="button" variant="outline" size="sm" disabled={uploadingFile} asChild>
                        <span>
                          {uploadingFile ? (
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          ) : (
                            <Upload className="h-4 w-4 mr-2" />
                          )}
                          Ajouter des fichiers
                        </span>
                      </Button>
                    </Label>
                  </div>
                </div>
                {participantFiles.length > 0 && (
                  <div className="space-y-2">
                    {participantFiles.map((pf) => (
                      <div
                        key={pf.id}
                        className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg"
                      >
                        <FileText className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                        <a
                          href={pf.file_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex-1 text-sm text-primary hover:underline truncate"
                        >
                          {pf.file_name}
                        </a>
                        <span className="text-xs text-muted-foreground flex-shrink-0">
                          {new Date(pf.uploaded_at).toLocaleDateString("fr-FR")}
                        </span>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-muted-foreground hover:text-destructive"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Supprimer ce fichier ?</AlertDialogTitle>
                              <AlertDialogDescription>
                                Le fichier "{pf.file_name}" sera supprimé définitivement.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Annuler</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => handleDeleteFile(pf)}
                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                              >
                                Supprimer
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Annuler
            </Button>
            <Button
              type="submit"
              form="edit-participant-form"
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Enregistrement...
                </>
              ) : (
                "Enregistrer"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default EditParticipantDialog;
