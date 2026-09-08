import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { toastError } from "@/lib/toastError";
import { useEdgeFunction } from "@/hooks/useEdgeFunction";

/**
 * Pièces jointes d'un signalement (indicateur 12).
 *
 * Le bucket est privé : aucune URL publique n'existe. L'ouverture d'un fichier
 * demande une URL signée à courte durée, créée au moment du clic — un lien
 * copié ne survit donc pas à la journée.
 */

/** Durée de validité d'un lien d'ouverture, en secondes. */
const SIGNED_URL_TTL = 300;

export interface VhdAttachment {
  id: string;
  report_id: string;
  file_name: string;
  file_path: string;
  file_size: number | null;
  content_type: string | null;
  created_at: string;
}

export function useVhdAttachments(reportId: string | null) {
  const [attachments, setAttachments] = useState<VhdAttachment[]>([]);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const { loading: uploading, invoke: invokeUpload } = useEdgeFunction("upload-vhd-attachment", {
    errorMessage: "Envoi de la pièce jointe impossible",
  });

  const fetchAttachments = useCallback(async () => {
    if (!reportId) {
      setAttachments([]);
      return;
    }
    setLoading(true);
    const { data, error } = await supabase
      .from("vhd_report_attachments")
      .select("*")
      .eq("report_id", reportId)
      .order("created_at", { ascending: false });
    setLoading(false);

    if (error) {
      console.error("Error fetching vhd attachments:", error);
      toastError(toast, "Impossible de charger les pièces jointes");
      return;
    }
    setAttachments((data || []) as unknown as VhdAttachment[]);
  }, [reportId, toast]);

  useEffect(() => {
    fetchAttachments();
  }, [fetchAttachments]);

  const upload = useCallback(
    async (file: File) => {
      if (!reportId) return;
      const form = new FormData();
      form.append("file", file);
      form.append("reportId", reportId);

      // `invoke` rend null en cas d'échec et a déjà signalé l'erreur.
      const result = await invokeUpload(form);
      if (!result) return;

      toast({ title: "Pièce jointe ajoutée" });
      await fetchAttachments();
    },
    [reportId, toast, fetchAttachments, invokeUpload],
  );

  /** URL signée à courte durée pour ouvrir un fichier. */
  const openUrl = useCallback(
    async (attachment: VhdAttachment): Promise<string | null> => {
      const { data, error } = await supabase.storage
        .from("vhd-attachments")
        .createSignedUrl(attachment.file_path, SIGNED_URL_TTL);

      if (error || !data?.signedUrl) {
        toastError(toast, "Impossible d'ouvrir cette pièce jointe");
        return null;
      }
      return data.signedUrl;
    },
    [toast],
  );

  const remove = useCallback(
    async (attachment: VhdAttachment) => {
      // Le fichier part avant sa fiche : l'ordre inverse laisserait un objet
      // orphelin dans le bucket, que plus rien ne désignerait.
      const { error: storageError } = await supabase.storage
        .from("vhd-attachments")
        .remove([attachment.file_path]);
      if (storageError) {
        toastError(toast, "Impossible de supprimer le fichier");
        return;
      }

      const { error } = await supabase
        .from("vhd_report_attachments")
        .delete()
        .eq("id", attachment.id);
      if (error) {
        toastError(toast, "Fichier supprimé mais la fiche subsiste");
        return;
      }

      toast({ title: "Pièce jointe supprimée" });
      await fetchAttachments();
    },
    [toast, fetchAttachments],
  );

  return { attachments, loading, uploading, upload, openUrl, remove, refresh: fetchAttachments };
}
