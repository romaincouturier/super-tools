import { useQuery } from "@tanstack/react-query";
import { invokeEdge } from "@/lib/invokeEdge";

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

type AcademyCatalogResponse = { courses: AcademyCatalogCourse[] };

export function useAcademyCatalog() {
  return useQuery({
    queryKey: ["academy-catalog"],
    queryFn: () => invokeEdge<AcademyCatalogResponse>("get-academy-catalog"),
    staleTime: 5 * 60 * 1000,
  });
}
