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
  source: "mission" | "event" | "training";
}

const MEDIA_LIBRARY_KEY = "media-library";

export const useMediaLibrary = () => {
  return useQuery({
    queryKey: [MEDIA_LIBRARY_KEY],
    queryFn: async () => {
      // Fetch mission media
      const { data: missionData, error: missionError } = await (supabase as any)
        .from("mission_media")
        .select("*, missions!inner(title, tags, emoji, color)")
        .order("created_at", { ascending: false });

      if (missionError) throw missionError;

      const missionItems: MediaItemWithMission[] = ((missionData || []) as any[]).map((item) => ({
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
        source: "mission" as const,
      }));

      // Fetch event media (images only — video_link entries are just URLs, not actual media files)
      const { data: eventData, error: eventError } = await (supabase as any)
        .from("event_media")
        .select("*, events!inner(title, event_date)")
        .eq("file_type", "image")
        .order("created_at", { ascending: false });

      if (eventError) {
        // If events table doesn't exist yet (migration not run), just return mission items
        console.warn("Could not fetch event media:", eventError.message);
        return missionItems;
      }

      const eventItems: MediaItemWithMission[] = ((eventData || []) as any[]).map((item) => ({
        id: item.id,
        mission_id: item.event_id, // reuse field for filtering
        file_url: item.file_url,
        file_name: item.file_name,
        file_type: "image" as const,
        mime_type: item.mime_type,
        file_size: item.file_size,
        position: item.position,
        created_at: item.created_at,
        mission_title: item.events?.title || "Événement",
        mission_tags: ["événement"],
        mission_emoji: null,
        mission_color: null,
        source: "event" as const,
      }));

      // Fetch training media (photos & videos linked to formations)
      const { data: trainingData, error: trainingError } = await (supabase as any)
        .from("training_media")
        .select("*, trainings!inner(training_name)")
        .order("created_at", { ascending: false });

      let trainingItems: MediaItemWithMission[] = [];
      if (trainingError) {
        console.warn("Could not fetch training media:", trainingError.message);
      } else {
        trainingItems = ((trainingData || []) as any[]).map((item) => ({
          id: item.id,
          mission_id: item.training_id, // reuse field for filtering
          file_url: item.file_url,
          file_name: item.file_name,
          file_type: item.file_type,
          mime_type: item.mime_type,
          file_size: item.file_size,
          position: item.position,
          created_at: item.created_at,
          mission_title: item.trainings?.training_name || "Formation",
          mission_tags: [item.trainings?.training_name || "formation"],
          mission_emoji: null,
          mission_color: null,
          source: "training" as const,
        }));
      }

      // Merge and sort by created_at descending
      return [...missionItems, ...eventItems, ...trainingItems].sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
    },
  });
};
