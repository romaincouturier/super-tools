import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type AcademyCatalogCourse = {
  id: string;
  title: string;
  description: string | null;
  cover_image_url: string | null;
  estimated_duration_minutes: number | null;
  access_type: "gratuit" | "payant";
  expertise: string | null;
  is_featured: boolean;
  formation_config_id: string | null;
  formation_configs: {
    formation_name: string;
    supertilt_link: string | null;
    prix: number | null;
    duree_heures: number | null;
  } | null;
};

export function useAcademyCatalog() {
  return useQuery({
    queryKey: ["academy-catalog"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("lms_courses")
        .select("id, title, description, cover_image_url, estimated_duration_minutes, access_type, expertise, is_featured, formation_config_id, formation_configs(formation_name, supertilt_link, prix, duree_heures)")
        .eq("status", "published")
        .in("access_type", ["gratuit", "payant"])
        .order("is_featured", { ascending: false });

      if (error) throw error;
      return { courses: (data ?? []) as AcademyCatalogCourse[] };
    },
    staleTime: 5 * 60 * 1000,
  });
}
