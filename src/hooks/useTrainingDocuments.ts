import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { sanitizeFileName, extractStoragePath } from "@/lib/file-utils";

export interface TrainingDocument {
  id: string;
  training_id: string;
  file_name: string;
  file_url: string;
  file_size: number | null;
  uploaded_by: string | null;
  created_at: string;
}

const TRAINING_DOCUMENTS_KEY = "training-documents";
const STORAGE_BUCKET = "training-documents";

// ── Fetch documents for a training ───────────────────────────────────
export const useTrainingDocuments = (trainingId: string) => {
  return useQuery({
    queryKey: [TRAINING_DOCUMENTS_KEY, trainingId],
    enabled: !!trainingId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("training_documents")
        .select("*")
        .eq("training_id", trainingId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return (data || []) as TrainingDocument[];
    },
  });
};

// ── Add a document record ────────────────────────────────────────────
export const useAddTrainingDocument = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      training_id: string;
      file_name: string;
      file_url: string;
      file_size: number | null;
    }) => {
      const { data: session } = await supabase.auth.getSession();
      const userId = session.session?.user?.id;
      const { data, error } = await supabase
        .from("training_documents")
        .insert({ ...input, uploaded_by: userId })
        .select()
        .single();
      if (error) throw error;
      return data as TrainingDocument;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: [TRAINING_DOCUMENTS_KEY, variables.training_id],
      });
    },
  });
};

// ── Delete a document record ─────────────────────────────────────────
export const useDeleteTrainingDocument = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      trainingId,
    }: {
      id: string;
      trainingId: string;
    }) => {
      const { error } = await supabase
        .from("training_documents")
        .delete()
        .eq("id", id);
      if (error) throw error;
      return trainingId;
    },
    onSuccess: (trainingId) => {
      queryClient.invalidateQueries({
        queryKey: [TRAINING_DOCUMENTS_KEY, trainingId],
      });
    },
  });
};

// ── Upload file to storage ───────────────────────────────────────────
export const uploadTrainingDocument = async (
  file: File,
  trainingId: string
): Promise<string> => {
  const path = `${trainingId}/docs/${Date.now()}_${sanitizeFileName(file.name)}`;

  const { error: uploadError } = await supabase.storage
    .from(STORAGE_BUCKET)
    .upload(path, file);

  if (uploadError) throw uploadError;

  const { data: urlData } = supabase.storage
    .from(STORAGE_BUCKET)
    .getPublicUrl(path);

  return urlData.publicUrl;
};

// ── Delete file from storage ─────────────────────────────────────────
export const deleteTrainingDocumentFile = async (
  fileUrl: string
): Promise<void> => {
  const filePath = extractStoragePath(fileUrl, STORAGE_BUCKET);
  if (filePath) {
    await supabase.storage.from(STORAGE_BUCKET).remove([filePath]);
  }
};
