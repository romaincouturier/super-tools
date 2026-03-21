import { useState } from "react";
import { Upload, FileText, Trash2, Loader2, Receipt, CheckCircle } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { formatSentDateTime } from "@/lib/dateFormatters";
import { sanitizeFileName, resolveContentType } from "@/lib/file-utils";
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

interface InvoiceSectionProps {
  trainingId: string;
  isInterEntreprise: boolean;
  invoiceFileUrl: string | null;
  setInvoiceFileUrl: (url: string | null) => void;
  invoiceSentAt: string | null;
  onUpdate?: () => void;
}

const getFileNameFromUrl = (url: string): string => {
  const parts = url.split("/");
  const fileName = parts[parts.length - 1];
  return fileName.replace(/^\d+_/, "").replace(/_/g, " ");
};

const InvoiceSection = ({
  trainingId,
  isInterEntreprise,
  invoiceFileUrl,
  setInvoiceFileUrl,
  invoiceSentAt,
  onUpdate,
}: InvoiceSectionProps) => {
  const [uploadingInvoice, setUploadingInvoice] = useState(false);
  const { toast } = useToast();

  const formatSentDate = formatSentDateTime;

  const handleInvoiceUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!resolveContentType(file).includes("pdf")) {
      toast({
        title: "Format non supporté",
        description: "Seuls les fichiers PDF sont acceptés.",
        variant: "destructive",
      });
      return;
    }

    setUploadingInvoice(true);

    try {
      const fileExt = file.name.split(".").pop();
      const baseName = file.name.replace(`.${fileExt}`, "");
      const sanitizedName = sanitizeFileName(baseName);
      const fileName = `${trainingId}/facture_${Date.now()}_${sanitizedName}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from("training-documents")
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from("training-documents")
        .getPublicUrl(fileName);

      const { error: updateError } = await supabase
        .from("trainings")
        .update({ invoice_file_url: publicUrl })
        .eq("id", trainingId);

      if (updateError) throw updateError;

      setInvoiceFileUrl(publicUrl);
      onUpdate?.();

      toast({
        title: "Facture uploadée",
        description: "La facture a été ajoutée à la formation.",
      });
    } catch (error: unknown) {
      console.error("Upload error:", error);
      toast({
        title: "Erreur d'upload",
        description: error instanceof Error ? error.message : "Une erreur est survenue.",
        variant: "destructive",
      });
    } finally {
      setUploadingInvoice(false);
    }
  };

  const handleDeleteInvoice = async () => {
    if (!invoiceFileUrl) return;

    try {
      const urlParts = invoiceFileUrl.split("/training-documents/");
      if (urlParts.length > 1) {
        await supabase.storage
          .from("training-documents")
          .remove([urlParts[1]]);
      }

      const { error: updateError } = await supabase
        .from("trainings")
        .update({ invoice_file_url: null })
        .eq("id", trainingId);

      if (updateError) throw updateError;

      setInvoiceFileUrl(null);
      onUpdate?.();

      toast({
        title: "Facture supprimée",
        description: "La facture a été retirée de la formation.",
      });
    } catch (error: unknown) {
      console.error("Delete error:", error);
      toast({
        title: "Erreur",
        description: error instanceof Error ? error.message : "Impossible de supprimer la facture.",
        variant: "destructive",
      });
    }
  };

  if (isInterEntreprise) {
    return (
      <div className="p-3 bg-muted/50 rounded-lg">
        <p className="text-sm text-muted-foreground flex items-center gap-2">
          <Receipt className="h-4 w-4" />
          Les factures sont gérées par participant (cliquez sur l&apos;icône facture dans la liste des participants)
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex flex-col gap-1">
          <Label className="flex items-center gap-2">
            <Receipt className="h-4 w-4" />
            Facture
          </Label>
          {invoiceSentAt && (
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              <CheckCircle className="h-3 w-3 text-primary" />
              Envoyée le {formatSentDate(invoiceSentAt)}
            </span>
          )}
        </div>
        {!invoiceFileUrl && (
          <div>
            <Input
              type="file"
              accept=".pdf"
              onChange={handleInvoiceUpload}
              disabled={uploadingInvoice}
              className="hidden"
              id="invoice-upload"
            />
            <Label htmlFor="invoice-upload" className="cursor-pointer">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={uploadingInvoice}
                asChild
              >
                <span>
                  {uploadingInvoice ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Upload className="h-4 w-4 mr-2" />
                  )}
                  Uploader
                </span>
              </Button>
            </Label>
          </div>
        )}
      </div>

      {invoiceFileUrl && (
        <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
          <FileText className="h-5 w-5 text-muted-foreground flex-shrink-0" />
          <a
            href={invoiceFileUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 text-sm text-primary hover:underline truncate"
          >
            {getFileNameFromUrl(invoiceFileUrl)}
          </a>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive">
                <Trash2 className="h-4 w-4" />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Supprimer la facture ?</AlertDialogTitle>
                <AlertDialogDescription>
                  Cette action est irréversible.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Annuler</AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleDeleteInvoice}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  Supprimer
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      )}
    </div>
  );
};

export default InvoiceSection;
