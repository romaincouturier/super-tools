import { supabase } from "@/integrations/supabase/client";

export interface CommunityTheme { id: string; name: string; sort_order: number }
export interface ThemedCourse { id: string; title: string; status: string; community_is_private: boolean; theme_ids: string[] }

export async function fetchCommunityThemesConfig(): Promise<{ themes: CommunityTheme[]; courses: ThemedCourse[] }> {
  const [themesRes, coursesRes, linksRes] = await Promise.all([
    supabase.from("community_themes").select("id, name, sort_order").order("sort_order"),
    supabase.from("lms_courses").select("id, title, status, community_is_private").order("title"),
    supabase.from("course_community_themes").select("course_id, theme_id"),
  ]);
  if (themesRes.error) throw themesRes.error;
  if (coursesRes.error) throw coursesRes.error;
  if (linksRes.error) throw linksRes.error;
  const links = linksRes.data ?? [];
  return {
    themes: themesRes.data ?? [],
    courses: (coursesRes.data ?? []).map((c) => ({
      ...c,
      theme_ids: links.filter((l) => l.course_id === c.id).map((l) => l.theme_id),
    })),
  };
}

export async function setCourseTheme(courseId: string, themeId: string, linked: boolean) {
  const q = linked
    ? supabase.from("course_community_themes").insert({ course_id: courseId, theme_id: themeId })
    : supabase.from("course_community_themes").delete().eq("course_id", courseId).eq("theme_id", themeId);
  const { error } = await q;
  if (error) throw error;
}

export async function setCoursePrivateCommunity(courseId: string, isPrivate: boolean) {
  const { error } = await supabase.from("lms_courses").update({ community_is_private: isPrivate }).eq("id", courseId);
  if (error) throw error;
}
