import { useState, useEffect, useCallback } from "react";
import { useToast } from "@/hooks/use-toast";
import {
  fetchConventionSignature,
  uploadSignedConvention,
  deleteSignedConvention,
} from "@/services/participants";
import type { ConventionSignatureStatus } from "@/services/participants";

export interface UseParticipantConventionOptions {
  participantId: string;
  trainingId: string;
  open: boolean;
  isInterEntreprise: boolean;
  sponsorEmail?: string | null;
  initialSignedConventionUrl: string | null;
  onParticipantUpdated: () => void;
}

export interface UseParticipantConventionReturn {
  signedConventionUrl: string | null;
  uploadingConvention: boolean;
  conventionSignature: ConventionSignatureStatus | null;
  handleConventionUpload: (e: React.ChangeEvent<HTMLInputElement>) => Promise<void>;
  handleConventionDelete: () => Promise<void>;
}

export function useParticipantConvention({
  participantId,
  trainingId,
  open,
  isInterEntreprise,
  sponsorEmail,
  initialSignedConventionUrl,
  onParticipantUpdated,
}: UseParticipantConventionOptions): UseParticipantConventionReturn {
  const { toast } = useToast();
  const [signedConventionUrl, setSignedConventionUrl] = useState<string | null>(
    initialSignedConventionUrl,
  );
  const [uploadingConvention, setUploadingConvention] = useState(false);
  const [conventionSignature, setConventionSignature] =
    useState<ConventionSignatureStatus | null>(null);

  // Reset when participant changes
  useEffect(() => {
    setSignedConventionUrl(initialSignedConventionUrl);
  }, [initialSignedConventionUrl]);

  // Fetch convention signature
  useEffect(() => {
    if (!open || !isInterEntreprise || !sponsorEmail) return;
    fetchConventionSignature(trainingId, sponsorEmail).then((data) => {
      if (data) setConventionSignature(data);
    });
  }, [open, isInterEntreprise, trainingId, sponsorEmail]);

  const handleConventionUpload = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      if (!file.type.includes("pdf")) {
        toast({
          title: "Format non support\u00e9",
          description: "Seuls les fichiers PDF sont accept\u00e9s.",
          variant: "destructive",
        });
        return;
      }
      setUploadingConvention(true);
      try {
        const publicUrl = await uploadSignedConvention(
          trainingId,
          participantId,
          file,
        );
        setSignedConventionUrl(publicUrl);
        onParticipantUpdated();
        toast({ title: "Convention upload\u00e9e" });
      } catch (error: unknown) {
        console.error(
          error instanceof Error ? error.message : "Erreur inconnue",
        );
        toast({
          title: "Erreur d'upload",
          description:
            error instanceof Error ? error.message : "Erreur inconnue",
          variant: "destructive",
        });
      } finally {
        setUploadingConvention(false);
      }
    },
    [trainingId, participantId, onParticipantUpdated, toast],
  );

  const handleConventionDelete = useCallback(async () => {
    if (!signedConventionUrl) return;
    try {
      await deleteSignedConvention(participantId, signedConventionUrl);
      setSignedConventionUrl(null);
      onParticipantUpdated();
      toast({ title: "Convention supprim\u00e9e" });
    } catch (error: unknown) {
      console.error(
        error instanceof Error ? error.message : "Erreur inconnue",
      );
      toast({
        title: "Erreur",
        description: "Impossible de supprimer.",
        variant: "destructive",
      });
    }
  }, [signedConventionUrl, participantId, onParticipantUpdated, toast]);

  return {
    signedConventionUrl,
    uploadingConvention,
    conventionSignature,
    handleConventionUpload,
    handleConventionDelete,
  };
}
