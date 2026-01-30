import { useState } from "react";
import { Upload, FileText, Trash2, Loader2, Send, Receipt, ClipboardList } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface DocumentsManagerProps {
  trainingId: string;
  invoiceFileUrl: string | null;
  attendanceSheetsUrls: string[];
  sponsorEmail: string | null;
  sponsorName: string | null;
  onDocumentsChange: (invoice: string | null, sheets: string[]) => void;
}

const DocumentsManager = ({
  trainingId,
  invoiceFileUrl,
  attendanceSheetsUrls,
  sponsorEmail,
  sponsorName,
  onDocumentsChange,
}: DocumentsManagerProps) => {
  const [uploadingInvoice, setUploadingInvoice] = useState(false);
  const [uploadingSheet, setUploadingSheet] = useState(false);
  const [sendingDocuments, setSendingDocuments] = useState(false);
  const { toast } = useToast();

  const sanitizeFileName = (name: string): string => {
    return name
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[()[\]{}]/g, "")
      .replace(/\s+/g, "_")
      .replace(/[^a-zA-Z0-9_.-]/g, "");
  };

  const handleInvoiceUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.includes("pdf")) {
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

      onDocumentsChange(publicUrl, attendanceSheetsUrls);

      toast({
        title: "Facture uploadée",
        description: "La facture a été ajoutée à la formation.",
      });
    } catch (error: any) {
      console.error("Upload error:", error);
      toast({
        title: "Erreur d'upload",
        description: error.message || "Une erreur est survenue.",
        variant: "destructive",
      });
    } finally {
      setUploadingInvoice(false);
    }
  };

  const handleSheetUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.includes("pdf")) {
      toast({
        title: "Format non supporté",
        description: "Seuls les fichiers PDF sont acceptés.",
        variant: "destructive",
      });
      return;
    }

    setUploadingSheet(true);

    try {
      const fileExt = file.name.split(".").pop();
      const baseName = file.name.replace(`.${fileExt}`, "");
      const sanitizedName = sanitizeFileName(baseName);
      const fileName = `${trainingId}/emargement_${Date.now()}_${sanitizedName}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from("training-documents")
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from("training-documents")
        .getPublicUrl(fileName);

      onDocumentsChange(invoiceFileUrl, [...attendanceSheetsUrls, publicUrl]);

      toast({
        title: "Feuille d'émargement uploadée",
        description: "Le document a été ajouté à la formation.",
      });
    } catch (error: any) {
      console.error("Upload error:", error);
      toast({
        title: "Erreur d'upload",
        description: error.message || "Une erreur est survenue.",
        variant: "destructive",
      });
    } finally {
      setUploadingSheet(false);
    }
  };

  const handleDeleteInvoice = async () => {
    if (!invoiceFileUrl) return;

    try {
      // Extract file path from URL
      const urlParts = invoiceFileUrl.split("/training-documents/");
      if (urlParts.length > 1) {
        await supabase.storage
          .from("training-documents")
          .remove([urlParts[1]]);
      }

      onDocumentsChange(null, attendanceSheetsUrls);

      toast({
        title: "Facture supprimée",
        description: "La facture a été retirée de la formation.",
      });
    } catch (error: any) {
      console.error("Delete error:", error);
      toast({
        title: "Erreur",
        description: "Impossible de supprimer la facture.",
        variant: "destructive",
      });
    }
  };

  const handleDeleteSheet = async (sheetUrl: string) => {
    try {
      const urlParts = sheetUrl.split("/training-documents/");
      if (urlParts.length > 1) {
        await supabase.storage
          .from("training-documents")
          .remove([urlParts[1]]);
      }

      onDocumentsChange(
        invoiceFileUrl,
        attendanceSheetsUrls.filter((url) => url !== sheetUrl)
      );

      toast({
        title: "Feuille supprimée",
        description: "Le document a été retiré de la formation.",
      });
    } catch (error: any) {
      console.error("Delete error:", error);
      toast({
        title: "Erreur",
        description: "Impossible de supprimer le document.",
        variant: "destructive",
      });
    }
  };

  const handleSendDocuments = async (type: "invoice" | "sheets" | "all") => {
    if (!sponsorEmail) {
      toast({
        title: "Email manquant",
        description: "Aucun email de commanditaire n'est défini pour cette formation.",
        variant: "destructive",
      });
      return;
    }

    const hasInvoice = invoiceFileUrl;
    const hasSheets = attendanceSheetsUrls.length > 0;

    if (type === "invoice" && !hasInvoice) {
      toast({
        title: "Pas de facture",
        description: "Aucune facture n'a été uploadée.",
        variant: "destructive",
      });
      return;
    }

    if (type === "sheets" && !hasSheets) {
      toast({
        title: "Pas de feuilles",
        description: "Aucune feuille d'émargement n'a été uploadée.",
        variant: "destructive",
      });
      return;
    }

    setSendingDocuments(true);

    try {
      const { error } = await supabase.functions.invoke("send-training-documents", {
        body: {
          trainingId,
          recipientEmail: sponsorEmail,
          recipientName: sponsorName,
          documentType: type,
          invoiceUrl: type === "sheets" ? null : invoiceFileUrl,
          attendanceSheetsUrls: type === "invoice" ? [] : attendanceSheetsUrls,
        },
      });

      if (error) throw error;

      toast({
        title: "Documents envoyés",
        description: `Les documents ont été envoyés à ${sponsorEmail}.`,
      });
    } catch (error: any) {
      console.error("Send error:", error);
      toast({
        title: "Erreur d'envoi",
        description: error.message || "Impossible d'envoyer les documents.",
        variant: "destructive",
      });
    } finally {
      setSendingDocuments(false);
    }
  };

  const getFileNameFromUrl = (url: string): string => {
    const parts = url.split("/");
    const fileName = parts[parts.length - 1];
    // Remove timestamp prefix and clean up
    return fileName.replace(/^\d+_/, "").replace(/_/g, " ");
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="h-5 w-5" />
          Documents administratifs
        </CardTitle>
        <CardDescription>
          Gérez la facture et les feuilles d'émargement de cette formation
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Invoice Section */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label className="flex items-center gap-2">
              <Receipt className="h-4 w-4" />
              Facture
            </Label>
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

        {/* Attendance Sheets Section */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label className="flex items-center gap-2">
              <ClipboardList className="h-4 w-4" />
              Feuilles d'émargement ({attendanceSheetsUrls.length})
            </Label>
            <div>
              <Input
                type="file"
                accept=".pdf"
                onChange={handleSheetUpload}
                disabled={uploadingSheet}
                className="hidden"
                id="sheet-upload"
              />
              <Label htmlFor="sheet-upload" className="cursor-pointer">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={uploadingSheet}
                  asChild
                >
                  <span>
                    {uploadingSheet ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Upload className="h-4 w-4 mr-2" />
                    )}
                    Ajouter
                  </span>
                </Button>
              </Label>
            </div>
          </div>

          {attendanceSheetsUrls.length > 0 && (
            <div className="space-y-2">
              {attendanceSheetsUrls.map((url, index) => (
                <div
                  key={index}
                  className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg"
                >
                  <FileText className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                  <a
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 text-sm text-primary hover:underline truncate"
                  >
                    Feuille {index + 1} - {getFileNameFromUrl(url)}
                  </a>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Supprimer cette feuille ?</AlertDialogTitle>
                        <AlertDialogDescription>
                          Cette action est irréversible.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Annuler</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() => handleDeleteSheet(url)}
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
        </div>

        {/* Send to Sponsor Button */}
        {sponsorEmail && (invoiceFileUrl || attendanceSheetsUrls.length > 0) && (
          <div className="pt-4 border-t">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  type="button"
                  variant="default"
                  className="w-full"
                  disabled={sendingDocuments}
                >
                  {sendingDocuments ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4 mr-2" />
                  )}
                  Envoyer au commanditaire
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                {invoiceFileUrl && (
                  <DropdownMenuItem onClick={() => handleSendDocuments("invoice")}>
                    <Receipt className="h-4 w-4 mr-2" />
                    Envoyer la facture
                  </DropdownMenuItem>
                )}
                {attendanceSheetsUrls.length > 0 && (
                  <DropdownMenuItem onClick={() => handleSendDocuments("sheets")}>
                    <ClipboardList className="h-4 w-4 mr-2" />
                    Envoyer les feuilles d'émargement
                  </DropdownMenuItem>
                )}
                {invoiceFileUrl && attendanceSheetsUrls.length > 0 && (
                  <DropdownMenuItem onClick={() => handleSendDocuments("all")}>
                    <FileText className="h-4 w-4 mr-2" />
                    Envoyer tous les documents
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
            <p className="text-xs text-muted-foreground text-center mt-2">
              Destinataire : {sponsorName ? `${sponsorName} (${sponsorEmail})` : sponsorEmail}
            </p>
          </div>
        )}

        {!sponsorEmail && (invoiceFileUrl || attendanceSheetsUrls.length > 0) && (
          <p className="text-sm text-amber-600 dark:text-amber-500 text-center pt-4 border-t">
            ⚠️ Ajoutez un email de commanditaire pour pouvoir envoyer les documents.
          </p>
        )}
      </CardContent>
    </Card>
  );
};

export default DocumentsManager;
