import { useQuery, useMutation, useQueryClient, QueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { sanitizeFileName, resolveContentType } from "@/lib/file-utils";

export type MediaSourceType = "mission" | "event" | "training" | "crm" | "content" | "lms";

export interface MediaItem {
  id: string;
  file_url: string;
  file_name: string;
  file_type: "image" | "video" | "video_link" | "audio";
  mime_type: string | null;
  file_size: number | null;
  position: number;
  source_type: MediaSourceType;
  source_id: string;
  created_at: string;
  created_by: string | null;
  is_deliverable: boolean;
  transcript: string | null;
  tags: string[];
  // Joined label for display in gallery
  source_label: string;
  source_emoji: string | null;
  source_color: string | null;
  source_tags: string[];
}

const MEDIA_LIBRARY_KEY = "media-library";
const ENTITY_MEDIA_KEY = "entity-media";

// ── Fetch all media for the central gallery ──────────────────────────
export const useMediaLibrary = () => {
  return useQuery({
    queryKey: [MEDIA_LIBRARY_KEY],
    queryFn: async () => {
      // Fetch all media
      const { data: mediaRows, error } = await supabase
        .from("media")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;

      const rows = mediaRows || [];

      // Collect source ids per type for batch label lookup
      const missionIds = [...new Set(rows.filter((r) => r.source_type === "mission").map((r) => r.source_id))];
      const eventIds = [...new Set(rows.filter((r) => r.source_type === "event").map((r) => r.source_id))];
      const trainingIds = [...new Set(rows.filter((r) => r.source_type === "training").map((r) => r.source_id))];
      const crmIds = [...new Set(rows.filter((r) => r.source_type === "crm").map((r) => r.source_id))];
      const contentIds = [...new Set(rows.filter((r) => r.source_type === "content").map((r) => r.source_id))];
      const lmsIds = [...new Set(rows.filter((r) => r.source_type === "lms").map((r) => r.source_id))];

      // Fetch labels
      const labelMap: Record<string, { label: string; emoji: string | null; color: string | null; tags: string[] }> = {};

      if (missionIds.length > 0) {
        const { data } = await supabase
          .from("missions")
          .select("id, title, emoji, color, tags")
          .in("id", missionIds);
        (data || []).forEach((m) => {
          labelMap[m.id] = { label: m.title, emoji: m.emoji ?? null, color: m.color, tags: m.tags || [] };
        });
      }

      if (eventIds.length > 0) {
        const { data } = await supabase
          .from("events")
          .select("id, title")
          .in("id", eventIds);
        (data || []).forEach((e) => {
          labelMap[e.id] = { label: e.title, emoji: null, color: null, tags: ["événement"] };
        });
      }

      if (trainingIds.length > 0) {
        const { data } = await supabase
          .from("trainings")
          .select("id, training_name")
          .in("id", trainingIds);
        (data || []).forEach((t) => {
          labelMap[t.id] = { label: t.training_name, emoji: null, color: null, tags: ["formation"] };
        });
      }

      if (crmIds.length > 0) {
        const { data } = await supabase
          .from("crm_cards")
          .select("id, title, emoji")
          .in("id", crmIds);
        (data || []).forEach((c) => {
          labelMap[c.id] = { label: c.title, emoji: c.emoji ?? null, color: null, tags: ["opportunité"] };
        });
      }

      if (contentIds.length > 0) {
        const { data } = await supabase
          .from("content_cards")
          .select("id, title, emoji")
          .in("id", contentIds);
        (data || []).forEach((c) => {
          labelMap[c.id] = { label: c.title, emoji: c.emoji ?? null, color: null, tags: ["contenu"] };
        });
      }

      if (lmsIds.length > 0) {
        const { data } = await supabase
          .from("lms_lessons")
          .select("id, title")
          .in("id", lmsIds);
        (data || []).forEach((l) => {
          labelMap[l.id] = { label: l.title, emoji: null, color: null, tags: ["formation en ligne"] };
        });
      }

      return rows.map((row: any): MediaItem => {
        const info = labelMap[row.source_id] || { label: "Inconnu", emoji: null, color: null, tags: [] };
        return {
          id: row.id,
          file_url: row.file_url,
          file_name: row.file_name,
          file_type: row.file_type as MediaItem["file_type"],
          mime_type: row.mime_type,
          file_size: row.file_size,
          position: row.position,
          source_type: row.source_type as MediaSourceType,
          source_id: row.source_id,
          created_at: row.created_at,
          created_by: row.created_by,
          is_deliverable: row.is_deliverable ?? false,
          transcript: row.transcript ?? null,
          tags: row.tags || [],
          source_label: info.label,
          source_emoji: info.emoji,
          source_color: info.color,
          source_tags: info.tags,
        };
      });
    },
  });
};

// ── Fetch media for a specific entity ────────────────────────────────
export const useEntityMedia = (sourceType: MediaSourceType, sourceId: string | undefined) => {
  return useQuery({
    queryKey: [ENTITY_MEDIA_KEY, sourceType, sourceId],
    enabled: !!sourceId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("media")
        .select("*")
        .eq("source_type", sourceType)
        .eq("source_id", sourceId)
        .order("created_at", { ascending: false });

      if (error) throw error;

      return (data || []) as unknown as MediaItem[];
    },
  });
};

/** Invalidate both media caches. If source info is provided, also targets the entity-specific cache. */
function invalidateMediaCaches(qc: QueryClient, sourceType?: MediaSourceType, sourceId?: string) {
  qc.invalidateQueries({ queryKey: [MEDIA_LIBRARY_KEY] });
  if (sourceType && sourceId) {
    qc.invalidateQueries({ queryKey: [ENTITY_MEDIA_KEY, sourceType, sourceId] });
  } else {
    qc.invalidateQueries({ queryKey: [ENTITY_MEDIA_KEY] });
  }
}

// ── Add media ────────────────────────────────────────────────────────
export const useAddMedia = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      file_url: string;
      file_name: string;
      file_type: "image" | "video" | "video_link" | "audio";
      mime_type: string | null;
      file_size: number | null;
      position: number;
      source_type: MediaSourceType;
      source_id: string;
    }) => {
      const { data: session } = await supabase.auth.getSession();
      const userId = session.session?.user?.id;
      const { data, error } = await supabase
        .from("media")
        .insert({ ...input, created_by: userId })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      invalidateMediaCaches(queryClient, variables.source_type, variables.source_id);
    },
  });
};

// ── Delete media ─────────────────────────────────────────────────────
export const useDeleteMedia = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, sourceType, sourceId }: { id: string; sourceType: MediaSourceType; sourceId: string }) => {
      const { error } = await supabase
        .from("media")
        .delete()
        .eq("id", id);
      if (error) throw error;
      return { sourceType, sourceId };
    },
    onSuccess: ({ sourceType, sourceId }) => {
      invalidateMediaCaches(queryClient, sourceType, sourceId);
    },
  });
};

// ── Update media tags ────────────────────────────────────────────────
export const useUpdateMediaTags = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, tags }: { id: string; tags: string[] }) => {
      const { error } = await supabase
        .from("media")
        .update({ tags })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      invalidateMediaCaches(queryClient);
    },
  });
};

// ── Toggle deliverable ───────────────────────────────────────────────
export const useToggleMediaDeliverable = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, sourceType, sourceId, is_deliverable }: { id: string; sourceType: MediaSourceType; sourceId: string; is_deliverable: boolean }) => {
      const { error } = await supabase
        .from("media")
        .update({ is_deliverable })
        .eq("id", id);
      if (error) throw error;
      return { sourceType, sourceId };
    },
    onSuccess: ({ sourceType, sourceId }) => {
      invalidateMediaCaches(queryClient, sourceType, sourceId);
    },
  });
};

// ── Rename media ─────────────────────────────────────────────────────
export const useRenameMedia = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, file_name }: { id: string; file_name: string }) => {
      const { error } = await supabase
        .from("media")
        .update({ file_name })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      invalidateMediaCaches(queryClient);
    },
  });
};

// ── Update transcript ────────────────────────────────────────────────
export const useUpdateMediaTranscript = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, transcript, sourceType, sourceId }: { id: string; transcript: string; sourceType: MediaSourceType; sourceId: string }) => {
      const { error } = await supabase
        .from("media")
        .update({ transcript })
        .eq("id", id);
      if (error) throw error;
      return { sourceType, sourceId };
    },
    onSuccess: ({ sourceType, sourceId }) => {
      invalidateMediaCaches(queryClient, sourceType, sourceId);
    },
  });
};


const STORAGE_BUCKET = "media";

export const uploadMediaFile = async (file: File, sourceType: MediaSourceType, sourceId: string) => {
  const path = `${sourceType}/${sourceId}/${Date.now()}_${sanitizeFileName(file.name)}`;
  const resolvedContentType = resolveContentType(file);

  // Some browsers (notably iOS Safari) attach unsupported non-standard MIME types
  // to the File object (e.g. audio/x-m4a). Rebuild the file with normalized type
  // so storage validation checks the supported MIME.
  const normalizedFile =
    file.type && file.type !== resolvedContentType
      ? new File([file], file.name, {
          type: resolvedContentType,
          lastModified: file.lastModified,
        })
      : file;

  const { error: uploadError } = await supabase.storage
    .from(STORAGE_BUCKET)
    .upload(path, normalizedFile, { contentType: resolvedContentType });

  if (uploadError) throw uploadError;

  const { data: urlData } = supabase.storage
    .from(STORAGE_BUCKET)
    .getPublicUrl(path);

  return urlData.publicUrl;
};

/**
 * Register a file (already uploaded to any bucket) into the central media library.
 * Skips silently if the file_url is already registered.
 */
export const registerMediaEntry = async (entry: {
  file_url: string;
  file_name: string;
  file_type: "image" | "video" | "video_link" | "audio";
  mime_type: string | null;
  file_size: number | null;
  source_type: MediaSourceType;
  source_id: string;
}) => {
  try {
    const { data: session } = await supabase.auth.getSession();
    const userId = session.session?.user?.id || null;
    await supabase.from("media").insert({
      ...entry,
      position: 0,
      created_by: userId,
    });
  } catch {
    // Best-effort: don't break the upload flow if registration fails
    console.warn("Failed to register media entry:", entry.file_url);
  }
};

export const deleteMediaFile = async (fileUrl: string) => {
  const url = new URL(fileUrl);

  // Handle files in any of the known buckets
  const buckets = ["media", "mission-media", "event-media", "training-media", "content-images"];
  for (const bucket of buckets) {
    const marker = `/${bucket}/`;
    const idx = url.pathname.indexOf(marker);
    if (idx !== -1) {
      const filePath = decodeURIComponent(url.pathname.slice(idx + marker.length));
      await supabase.storage.from(bucket).remove([filePath]);
      return;
    }
  }
};
