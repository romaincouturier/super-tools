import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface TrainingMediaItem {
  id: string;
  training_id: string;
  file_url: string;
  file_name: string;
  file_type: "image" | "video";
  mime_type: string | null;
  file_size: number | null;
  position: number;
  created_at: string;
}

const TRAINING_MEDIA_KEY = "training-media";

export const useTrainingMedia = (trainingId: string | undefined) => {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: [TRAINING_MEDIA_KEY, trainingId],
    enabled: !!trainingId,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("training_media")
        .select("*")
        .eq("training_id", trainingId)
        .order("created_at", { ascending: false });

      if (error) throw error;

      return (data || []) as TrainingMediaItem[];
    },
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: [TRAINING_MEDIA_KEY, trainingId] });
    queryClient.invalidateQueries({ queryKey: ["media-library"] });
  };

  return { ...query, invalidate };
};
