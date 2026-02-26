/**
 * Generic hook for managing documents attached to any entity
 * (missions, trainings, etc.). Replaces per-module copy-paste hooks.
 */
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { sanitizeFileName, extractStoragePath } from "@/lib/file-utils";

// ── Types ────────────────────────────────────────────────────────────

export type DocumentEntityType = "mission" | "training";

export interface EntityDocument {
  id: string;
  entity_id: string;
  file_name: string;
  file_url: string;
  file_size: number | null;
  uploaded_by: string | null;
  created_at: string;
  is_deliverable: boolean;
}

// ── Config per entity type ───────────────────────────────────────────

interface EntityDocumentConfig {
  table: string;
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
      const { data, error } = await (supabase as any)
        .from(config.table)
        .select("*")
        .eq(config.foreignKey, entityId)
        .order("created_at", { ascending: false });

      if (error) throw error;

      return (data || []).map((row: any): EntityDocument => ({
        id: row.id,
        entity_id: row[config.foreignKey],
        file_name: row.file_name,
        file_url: row.file_url,
        file_size: row.file_size,
        uploaded_by: row.uploaded_by,
        created_at: row.created_at,
        is_deliverable: row.is_deliverable ?? false,
      }));
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
      const { data, error } = await (supabase as any)
        .from(config.table)
        .insert({
          [config.foreignKey]: input.entityId,
          file_name: input.file_name,
          file_url: input.file_url,
          file_size: input.file_size,
          uploaded_by: userId,
        })
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
      const { error } = await (supabase as any)
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
      const { error } = await (supabase as any)
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
): Promise<string> => {
  const config = configs[entityType];
  const sanitized = sanitizeFileName(file.name);
  const path = `${entityId}/docs/${Date.now()}_${sanitized}`;

  const { error: uploadError } = await supabase.storage
    .from(config.bucket)
    .upload(path, file);

  if (uploadError) throw uploadError;

  const { data: urlData } = supabase.storage
    .from(config.bucket)
    .getPublicUrl(path);

  return urlData.publicUrl;
};

export const deleteEntityDocumentFile = async (
  fileUrl: string,
  entityType: DocumentEntityType,
): Promise<void> => {
  const config = configs[entityType];
  const filePath = extractStoragePath(fileUrl, config.bucket);
  if (filePath) {
    await supabase.storage.from(config.bucket).remove([filePath]);
  }
};
