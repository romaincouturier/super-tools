import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

export type RecoCourse = {
  id: string;
  title: string;
  description: string | null;
  cover_image_url: string | null;
  estimated_duration_minutes: number | null;
  boutique_url: string | null;
  prix: number | null;
};

export function useRecommendedCourses(excludedCourseIds: string[]) {
  const [courses, setCourses] = useState<RecoCourse[]>([]);
  const [loading, setLoading] = useState(true);
  const excludedKey = excludedCourseIds.slice().sort().join(",");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const [coursesRes, configsRes] = await Promise.all([
        (supabase as any)
          .from("lms_courses")
          .select("id, title, description, cover_image_url, estimated_duration_minutes")
          .eq("status", "published")
          .order("created_at", { ascending: true }),
        (supabase as any)
          .from("formation_configs")
          .select("formation_name, supertilt_link, prix")
          .not("supertilt_link", "is", null),
      ]);
      if (cancelled) return;
      const configs: Array<{ formation_name: string; supertilt_link: string | null; prix: number | null }> =
        configsRes.data || [];
      const matchConfig = (title: string) => {
        const t = (title || "").toLowerCase();
        return configs.find((c) => {
          const n = (c.formation_name || "").toLowerCase();
          if (!n) return false;
          return n.includes(t) || t.includes(n) ||
            n.split(" ").filter((w) => w.length > 4).some((w) => t.includes(w));
        });
      };
      const excludedSet = new Set(excludedCourseIds);
      const all: RecoCourse[] = (coursesRes.data || [])
        .filter((c: any) => !excludedSet.has(c.id))
        .map((c: any) => {
          const cfg = matchConfig(c.title);
          return {
            id: c.id,
            title: c.title,
            description: c.description,
            cover_image_url: c.cover_image_url,
            estimated_duration_minutes: c.estimated_duration_minutes,
            boutique_url: cfg?.supertilt_link ?? null,
            prix: cfg?.prix ?? null,
          };
        });
      setCourses(all);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [excludedKey]); // eslint-disable-line react-hooks/exhaustive-deps

  return { courses, loading };
}
