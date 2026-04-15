import { useState } from "react";
import { Upload, FileText, Trash2, ClipboardList, CheckCircle } from "lucide-react";
import { Spinner } from "@/components/ui/spinner";

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
import AttendanceSheetGenerator from "@/components/formations/AttendanceSheetGenerator";

interface AttendanceSheetSectionProps {
  trainingId: string;
  trainingName: string;
  trainerName: string;
  location: string;
  startDate: string | null;
  endDate: string | null;
  schedules: { day_date: string; start_time: string; end_time: string }[];
  participants: { id: string; first_name: string | null; last_name: string | null; email: string }[];
  attendanceSheetsUrls: string[];
  setAttendanceSheetsUrls: (urls: string[]) => void;
  sheetsSentAt: string | null;
  onUpdate?: () => void;
}

const getFileNameFromUrl = (url: string): string => {
  const parts = url.split("/");
  const fileName = parts[parts.length - 1];
  return fileName.replace(/^\d+_/, "").replace(/_/g, " ");
};

const AttendanceSheetSection = ({
  trainingId,
  trainingName,
  trainerName,
  location,
  startDate,
  endDate,
  schedules,
  participants,
  attendanceSheetsUrls,
  setAttendanceSheetsUrls,
  sheetsSentAt,
  onUpdate,
}: AttendanceSheetSectionProps) => {
  const [uploadingSheet, setUploadingSheet] = useState(false);
  const { toast } = useToast();

  const formatSentDate = formatSentDateTime;

  const handleSheetUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const allowedTypes = ["application/pdf", "image/jpeg", "image/png", "image/gif", "image/webp"];
    const validFiles: File[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (allowedTypes.includes(resolveContentType(file))) {
        validFiles.push(file);
      }
    }

    if (validFiles.length === 0) {
      toast({
        title: "Format non supporté",
        description: "Seuls les fichiers PDF et images (JPG, PNG, GIF, WebP) sont acceptés.",
        variant: "destructive",
      });
      return;
    }

    if (validFiles.length < files.length) {
      toast({
        title: "Fichiers ignorés",
        description: `${files.length - validFiles.length} fichier(s) ignoré(s) car non supporté(s).`,
        variant: "default",
      });
    }

    setUploadingSheet(true);

    try {
      const uploadedUrls: string[] = [];

      for (const file of validFiles) {
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

        uploadedUrls.push(publicUrl);
      }

      const newSheetsUrls = [...attendanceSheetsUrls, ...uploadedUrls];

      const { error: updateError } = await supabase
        .from("trainings")
        .update({ attendance_sheets_urls: newSheetsUrls })
        .eq("id", trainingId);

      if (updateError) throw updateError;

      setAttendanceSheetsUrls(newSheetsUrls);
      onUpdate?.();

      toast({
        title: validFiles.length > 1 ? "Feuilles d'émargement uploadées" : "Feuille d'émargement uploadée",
        description: `${validFiles.length} document(s) ajouté(s) à la formation.`,
      });
    } catch (error: unknown) {
      console.error("Upload error:", error);
      toast({
        title: "Erreur d'upload",
        description: error instanceof Error ? error.message : "Une erreur est survenue.",
        variant: "destructive",
      });
    } finally {
      setUploadingSheet(false);
      e.target.value = "";
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

      const newSheetsUrls = attendanceSheetsUrls.filter((url) => url !== sheetUrl);

      const { error: updateError } = await supabase
        .from("trainings")
        .update({ attendance_sheets_urls: newSheetsUrls })
        .eq("id", trainingId);

      if (updateError) throw updateError;

      setAttendanceSheetsUrls(newSheetsUrls);
      onUpdate?.();

      toast({
        title: "Feuille supprimée",
        description: "Le document a été retiré de la formation.",
      });
    } catch (error: unknown) {
      console.error("Delete error:", error);
      toast({
        title: "Erreur",
        description: error instanceof Error ? error.message : "Impossible de supprimer le document.",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex flex-col gap-1">
          <Label className="flex items-center gap-2">
            <ClipboardList className="h-4 w-4" />
            Feuilles d&apos;émargement ({attendanceSheetsUrls.length})
          </Label>
          {sheetsSentAt && (
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              <CheckCircle className="h-3 w-3 text-primary" />
              Envoyées le {formatSentDate(sheetsSentAt)}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <AttendanceSheetGenerator
            trainingName={trainingName}
            trainerName={trainerName}
            location={location}
            startDate={startDate || ""}
            endDate={endDate}
            schedules={schedules}
            participants={participants}
          />
          <div>
            <Input
              type="file"
              accept=".pdf,.jpg,.jpeg,.png,.gif,.webp,image/*"
              multiple
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
                    <Spinner className="mr-2" />
                  ) : (
                    <Upload className="h-4 w-4 mr-2" />
                  )}
                  Ajouter
                </span>
              </Button>
            </Label>
          </div>
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
  );
};

export default AttendanceSheetSection;
