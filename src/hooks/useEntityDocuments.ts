/**
 * Generic hook for managing documents attached to any entity
 * (missions, trainings, etc.). Replaces per-module copy-paste hooks.
 */
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { sanitizeFileName, extractStoragePath, resolveContentType } from "@/lib/file-utils";

// ── Types ────────────────────────────────────────────────────────────

export type DocumentEntityType = "mission" | "training";

export interface EntityDocument {
  id: string;
  entity_id: string;
  file_name: string;
  file_url: string;
  file_size: number | null;
  mime_type: string | null;
  uploaded_by: string | null;
  created_at: string;
  is_deliverable: boolean;
  processing_status: "none" | "pending" | "processing" | "completed" | "failed";
  processing_progress: number;
  processing_started_at: string | null;
  processing_completed_at: string | null;
  processing_error: string | null;
  processing_estimated_seconds: number | null;
  transcript_page_id: string | null;
}

// ── Config per entity type ───────────────────────────────────────────

interface EntityDocumentConfig {
  table: "mission_documents" | "training_documents";
  foreignKey: string;
  bucket: string;
  queryKey: string;
}

const configs: Record<DocumentEntityType, EntityDocumentConfig> = {
  mission: {
    table: "mission_documents",
    foreignKey: "mission_id",
    bucket: "mission-documents",
    queryKey: "mission-documents",
  },
  training: {
    table: "training_documents",
    foreignKey: "training_id",
    bucket: "training-documents",
    queryKey: "training-documents",
  },
};

// ── Fetch documents for an entity ────────────────────────────────────

export const useEntityDocuments = (entityType: DocumentEntityType, entityId: string | undefined) => {
  const config = configs[entityType];
  return useQuery({
    queryKey: [config.queryKey, entityId],
    enabled: !!entityId,
    queryFn: async () => {
      const { data, error } = await (supabase
        .from(config.table) as any)
        .select("*")
        .eq(config.foreignKey as any, entityId)
        .order("created_at", { ascending: false });

      if (error) throw error;

      return (data || []).map((row: any): EntityDocument => ({
        id: row.id,
        entity_id: row[config.foreignKey] as string,
        file_name: row.file_name,
        file_url: row.file_url,
        file_size: row.file_size,
        mime_type: row.mime_type ?? null,
        uploaded_by: row.uploaded_by,
        created_at: row.created_at,
        is_deliverable: row.is_deliverable ?? false,
        processing_status: row.processing_status ?? "none",
        processing_progress: row.processing_progress ?? 0,
        processing_started_at: row.processing_started_at ?? null,
        processing_completed_at: row.processing_completed_at ?? null,
        processing_error: row.processing_error ?? null,
        processing_estimated_seconds: row.processing_estimated_seconds ?? null,
        transcript_page_id: row.transcript_page_id ?? null,
      }));
    },
    refetchInterval: (query) => {
      const docs = query.state.data ?? [];
      return docs.some((doc: EntityDocument) => ["pending", "processing"].includes(doc.processing_status)) ? 3000 : false;
    },
  });
};

// ── Add a document ───────────────────────────────────────────────────

export const useAddEntityDocument = (entityType: DocumentEntityType) => {
  const config = configs[entityType];
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: {
      entityId: string;
      file_name: string;
      file_url: string;
      file_size: number | null;
    }) => {
      const { data: session } = await supabase.auth.getSession();
      const userId = session.session?.user?.id;
      const { data, error } = await supabase
        .from(config.table)
        .insert({
          [config.foreignKey]: input.entityId,
          file_name: input.file_name,
          file_url: input.file_url,
          file_size: input.file_size,
          uploaded_by: userId,
        } as any)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: [config.queryKey, variables.entityId],
      });
    },
  });
};

// ── Delete a document ────────────────────────────────────────────────

export const useDeleteEntityDocument = (entityType: DocumentEntityType) => {
  const config = configs[entityType];
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, entityId }: { id: string; entityId: string }) => {
      const { error } = await supabase
        .from(config.table)
        .delete()
        .eq("id", id);
      if (error) throw error;
      return entityId;
    },
    onSuccess: (entityId) => {
      queryClient.invalidateQueries({
        queryKey: [config.queryKey, entityId],
      });
    },
  });
};

// ── Toggle deliverable status ────────────────────────────────────────

export const useToggleDocumentDeliverable = (entityType: DocumentEntityType) => {
  const config = configs[entityType];
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, entityId, is_deliverable }: { id: string; entityId: string; is_deliverable: boolean }) => {
      const { error } = await supabase
        .from(config.table)
        .update({ is_deliverable })
        .eq("id", id);
      if (error) throw error;
      return entityId;
    },
    onSuccess: (entityId) => {
      queryClient.invalidateQueries({
        queryKey: [config.queryKey, entityId],
      });
    },
  });
};

// ── Storage helpers ──────────────────────────────────────────────────

export const uploadEntityDocument = async (
  file: File,
  entityType: DocumentEntityType,
  entityId: string,
): Promise<{ file_url: string; document?: EntityDocument }> => {
  if (entityType === "mission" || entityType === "training") {
    const formData = new FormData();
    const idKey = entityType === "mission" ? "missionId" : "trainingId";
    const fnName = entityType === "mission" ? "upload-mission-document" : "upload-training-document";
    formData.append(idKey, entityId);
    formData.append("file", file);

    const { data, error } = await supabase.functions.invoke(fnName, {
      body: formData,
    });

    if (error) throw error;
    const document = (data as { document?: EntityDocument & { file_url?: string } } | null)?.document;
    if (!document?.file_url) throw new Error("URL du document introuvable après upload");
    return { file_url: document.file_url, document };
  }

  throw new Error(`Type d'entité non supporté: ${entityType}`);
};

export const deleteEntityDocumentFile = async (
  fileUrl: string,
  entityType: DocumentEntityType,
): Promise<void> => {
  const config = configs[entityType];
  const filePath = extractStoragePath(fileUrl, config.bucket);
  if (filePath) {
    try {
      await supabase.storage.from(config.bucket).remove([filePath]);
    } catch (err) {
      // Storage deletion is best-effort — don't block DB row removal
      console.warn("[deleteEntityDocumentFile] Storage removal failed:", err);
    }
  }
};
