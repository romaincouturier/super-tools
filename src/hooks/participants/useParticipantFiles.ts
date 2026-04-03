import { useState, useEffect, useCallback } from "react";
import { useToast } from "@/hooks/use-toast";
import {
  fetchParticipantFiles,
  uploadParticipantFile,
  deleteParticipantFile,
} from "@/services/participants";
import type { ParticipantFile } from "@/services/participants";

export interface UseParticipantFilesOptions {
  participantId: string;
  trainingId: string;
  open: boolean;
  isInterEntreprise: boolean;
}

export interface UseParticipantFilesReturn {
  participantFiles: ParticipantFile[];
  uploadingFile: boolean;
  handleFileUpload: (e: React.ChangeEvent<HTMLInputElement>) => Promise<void>;
  handleDeleteFile: (fileToDelete: ParticipantFile) => Promise<void>;
}

export function useParticipantFiles({
  participantId,
  trainingId,
  open,
  isInterEntreprise,
}: UseParticipantFilesOptions): UseParticipantFilesReturn {
  const { toast } = useToast();
  const [participantFiles, setParticipantFiles] = useState<ParticipantFile[]>(
    [],
  );
  const [uploadingFile, setUploadingFile] = useState(false);

  useEffect(() => {
    if (!open || !isInterEntreprise) return;
    fetchParticipantFiles(participantId).then(setParticipantFiles);
  }, [open, isInterEntreprise, participantId]);

  const handleFileUpload = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (!files || files.length === 0) return;

      setUploadingFile(true);
      const uploadedFiles: ParticipantFile[] = [];
      let errorCount = 0;

      try {
        for (const file of Array.from(files)) {
          try {
            const uploaded = await uploadParticipantFile(
              trainingId,
              participantId,
              file,
            );
            uploadedFiles.push(uploaded);
          } catch (error: unknown) {
            console.error(
              `File upload error for ${file.name}:`,
              error instanceof Error ? error.message : "Erreur inconnue",
            );
            errorCount++;
          }
        }

        if (uploadedFiles.length > 0) {
          setParticipantFiles((prev) => [...uploadedFiles, ...prev]);
          toast({
            title: `${uploadedFiles.length} fichier${uploadedFiles.length > 1 ? "s" : ""} ajouté${uploadedFiles.length > 1 ? "s" : ""}`,
            ...(errorCount > 0 && {
              description: `${errorCount} fichier${errorCount > 1 ? "s" : ""} en erreur.`,
              variant: "destructive" as const,
            }),
          });
        } else if (errorCount > 0) {
          toast({
            title: "Erreur d'upload",
            description: "Aucun fichier n'a pu être uploadé.",
            variant: "destructive",
          });
        }
      } finally {
        setUploadingFile(false);
        e.target.value = "";
      }
    },
    [trainingId, participantId, toast],
  );

  const handleDeleteFile = useCallback(
    async (fileToDelete: ParticipantFile) => {
      try {
        await deleteParticipantFile(fileToDelete);
        setParticipantFiles((prev) =>
          prev.filter((f) => f.id !== fileToDelete.id),
        );
        toast({ title: "Fichier supprimé" });
      } catch (error: unknown) {
        console.error(
          "Delete file error:",
          error instanceof Error ? error.message : "Erreur inconnue",
        );
        toast({
          title: "Erreur",
          description: "Impossible de supprimer le fichier.",
          variant: "destructive",
        });
      }
    },
    [toast],
  );

  return {
    participantFiles,
    uploadingFile,
    handleFileUpload,
    handleDeleteFile,
  };
}
