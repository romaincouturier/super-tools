import { useQuery, useMutation, useQueryClient, useInfiniteQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { resolveContentType } from "@/lib/file-utils";

// ── Types ───────────────────────────────────────────────────────────

export type WatchContentType = "text" | "url" | "image" | "audio";

export interface WatchItem {
  id: string;
  title: string;
  body: string;
  content_type: WatchContentType;
  source_url: string | null;
  file_url: string | null;
  file_name: string | null;
  file_size: number | null;
  mime_type: string | null;
  tags: string[];
  relevance_score: number;
  is_shared: boolean;
  is_duplicate: boolean;
  duplicate_of: string | null;
  cluster_id: string | null;
  created_at: string;
  updated_at: string;
  created_by: string | null;
}

export interface WatchCluster {
  id: string;
  title: string;
  summary: string;
  slack_posted_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface WatchDigest {
  id: string;
  week_start: string;
  week_end: string;
  summary: string;
  item_ids: string[];
  slack_posted_at: string | null;
  created_at: string;
}

// ── Query keys ──────────────────────────────────────────────────────

const WATCH_ITEMS_KEY = "watch-items";
const WATCH_TAGS_KEY = "watch-tags";
const WATCH_CLUSTERS_KEY = "watch-clusters";
const WATCH_DIGESTS_KEY = "watch-digests";

const PAGE_SIZE = 30;

// ── Fetch items with pagination ─────────────────────────────────────

interface UseWatchItemsParams {
  search?: string;
  tags?: string[];
  contentType?: WatchContentType | "all";
  sharedOnly?: boolean;
}

export const useWatchItems = (params: UseWatchItemsParams = {}) => {
  const { search, tags, contentType, sharedOnly } = params;

  return useInfiniteQuery({
    queryKey: [WATCH_ITEMS_KEY, search, tags, contentType, sharedOnly],
    queryFn: async ({ pageParam = 0 }) => {
      let query = (supabase as any)
        .from("watch_items")
        .select("*")
        .order("relevance_score", { ascending: false })
        .order("created_at", { ascending: false })
        .range(pageParam, pageParam + PAGE_SIZE - 1);

      if (search) {
        query = query.or(`title.ilike.%${search}%,body.ilike.%${search}%`);
      }

      if (tags && tags.length > 0) {
        query = query.overlaps("tags", tags);
      }

      if (contentType && contentType !== "all") {
        query = query.eq("content_type", contentType);
      }

      if (sharedOnly) {
        query = query.eq("is_shared", true);
      }

      const { data, error } = await query;
      if (error) throw error;

      return {
        items: (data || []) as WatchItem[],
        nextOffset: data && data.length === PAGE_SIZE ? pageParam + PAGE_SIZE : undefined,
      };
    },
    getNextPageParam: (lastPage) => lastPage.nextOffset,
    initialPageParam: 0,
  });
};

// ── Fetch all unique tags ───────────────────────────────────────────

export const useWatchTags = () => {
  return useQuery({
    queryKey: [WATCH_TAGS_KEY],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("watch_items")
        .select("tags");

      if (error) throw error;

      const tagSet = new Set<string>();
      (data || []).forEach((row: { tags: string[] }) => {
        (row.tags || []).forEach((t: string) => tagSet.add(t));
      });
      return Array.from(tagSet).sort();
    },
  });
};

// ── Add a watch item ────────────────────────────────────────────────

interface AddWatchItemInput {
  title: string;
  body: string;
  content_type: WatchContentType;
  source_url?: string | null;
  file_url?: string | null;
  file_name?: string | null;
  file_size?: number | null;
  mime_type?: string | null;
  tags?: string[];
}

export const useAddWatchItem = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: AddWatchItemInput) => {
      const { data: session } = await supabase.auth.getSession();
      const userId = session.session?.user?.id;

      const { data, error } = await (supabase as any)
        .from("watch_items")
        .insert({
          ...input,
          tags: input.tags || [],
          created_by: userId,
        })
        .select()
        .single();

      if (error) throw error;
      return data as WatchItem;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [WATCH_ITEMS_KEY] });
      queryClient.invalidateQueries({ queryKey: [WATCH_TAGS_KEY] });
    },
  });
};

// ── Update a watch item ─────────────────────────────────────────────

export const useUpdateWatchItem = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<WatchItem> & { id: string }) => {
      const { error } = await (supabase as any)
        .from("watch_items")
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [WATCH_ITEMS_KEY] });
      queryClient.invalidateQueries({ queryKey: [WATCH_TAGS_KEY] });
    },
  });
};

// ── Delete a watch item ─────────────────────────────────────────────

export const useDeleteWatchItem = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any)
        .from("watch_items")
        .delete()
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [WATCH_ITEMS_KEY] });
      queryClient.invalidateQueries({ queryKey: [WATCH_TAGS_KEY] });
    },
  });
};

// ── Toggle shared flag ──────────────────────────────────────────────

export const useToggleWatchShared = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, is_shared }: { id: string; is_shared: boolean }) => {
      const { error } = await (supabase as any)
        .from("watch_items")
        .update({ is_shared })
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [WATCH_ITEMS_KEY] });
    },
  });
};

// ── Clusters ────────────────────────────────────────────────────────

export const useWatchClusters = () => {
  return useQuery({
    queryKey: [WATCH_CLUSTERS_KEY],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("watch_clusters")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      return (data || []) as WatchCluster[];
    },
  });
};

// ── Digests ─────────────────────────────────────────────────────────

export const useWatchDigests = () => {
  return useQuery({
    queryKey: [WATCH_DIGESTS_KEY],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("watch_digests")
        .select("*")
        .order("week_start", { ascending: false })
        .limit(10);

      if (error) throw error;
      return (data || []) as WatchDigest[];
    },
  });
};

// ── Upload watch file ───────────────────────────────────────────────

export const uploadWatchFile = async (file: File) => {
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const path = `${Date.now()}_${safeName}`;

  const { error: uploadError } = await supabase.storage
    .from("watch")
    .upload(path, file, { contentType: resolveContentType(file) });

  if (uploadError) throw uploadError;

  const { data: urlData } = supabase.storage.from("watch").getPublicUrl(path);
  return urlData.publicUrl;
};
