import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { normalizeWatchSourceUrl, sortWatchSources, type WatchSource } from "@/lib/watchSources";

const KEY = "watch-sources";
export type ProposeWatchSourceInput = Pick<WatchSource, "expert" | "theme" | "name" | "type" | "language" | "url" | "why" | "how_to_follow" | "proposed_by">;

export function useWatchSources() {
  return useQuery({
    queryKey: [KEY],
    queryFn: async () => {
      const sources: WatchSource[] = [];
      for (let offset = 0; ; offset += 1000) {
        const { data, error } = await supabase.from("watch_sources").select("*")
          .order("created_at", { ascending: false }).order("id").range(offset, offset + 999);
        if (error) throw error;
        sources.push(...data as WatchSource[]);
        if (data.length < 1000) break;
      }
      return sortWatchSources(sources);
    },
  });
}

export function useProposeWatchSource() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (input: ProposeWatchSourceInput) => {
      const url = normalizeWatchSourceUrl(input.url);
      const { data, error } = await supabase.from("watch_sources")
        .insert({ ...input, url, status: "proposed" }).select("*").single();
      if (error?.code === "23505") {
        const existing = await supabase.from("watch_sources").select("*").eq("url", url).single();
        if (existing.error) throw existing.error;
        return { saved: false, source: existing.data };
      }
      if (error) throw error;
      return { saved: true, source: data };
    },
    onSuccess: () => client.invalidateQueries({ queryKey: [KEY] }),
  });
}

export function useUpdateWatchSource() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...patch }: Pick<WatchSource, "id"> & Partial<Pick<WatchSource, "status" | "usefulness" | "notes" | "theme" | "last_useful_at" | "items_count">>) => {
      const { data, error } = await supabase.from("watch_sources").update(patch).eq("id", id).select("*").single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => client.invalidateQueries({ queryKey: [KEY] }),
  });
}