import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface MediaItemWithMission {
  id: string;
  mission_id: string;
  file_url: string;
  file_name: string;
  file_type: "image" | "video";
  mime_type: string | null;
  file_size: number | null;
  position: number;
  created_at: string;
  mission_title: string;
  mission_tags: string[];
  mission_emoji: string | null;
  mission_color: string | null;
}

const MEDIA_LIBRARY_KEY = "media-library";

export const useMediaLibrary = () => {
  return useQuery({
    queryKey: [MEDIA_LIBRARY_KEY],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("mission_media")
        .select("*, missions!inner(title, tags, emoji, color)")
        .order("created_at", { ascending: false });

      if (error) throw error;

      return ((data || []) as any[]).map((item): MediaItemWithMission => ({
        id: item.id,
        mission_id: item.mission_id,
        file_url: item.file_url,
        file_name: item.file_name,
        file_type: item.file_type,
        mime_type: item.mime_type,
        file_size: item.file_size,
        position: item.position,
        created_at: item.created_at,
        mission_title: item.missions?.title || "Sans mission",
        mission_tags: item.missions?.tags || [],
        mission_emoji: item.missions?.emoji || null,
        mission_color: item.missions?.color || null,
      }));
    },
  });
};
