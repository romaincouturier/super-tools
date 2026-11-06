import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchCommunityThemesConfig, setCoursePrivateCommunity, setCourseTheme } from "@/services/community-themes";

const KEY = ["community_themes_config"];

export function useCommunityThemesConfig() {
  return useQuery({ queryKey: KEY, queryFn: fetchCommunityThemesConfig });
}

export function useSetCourseTheme() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { courseId: string; themeId: string; linked: boolean }) => setCourseTheme(v.courseId, v.themeId, v.linked),
    onSettled: () => { qc.invalidateQueries({ queryKey: KEY }); qc.invalidateQueries({ queryKey: ["community_spaces"] }); },
  });
}

export function useSetCoursePrivateCommunity() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { courseId: string; isPrivate: boolean }) => setCoursePrivateCommunity(v.courseId, v.isPrivate),
    onSettled: () => { qc.invalidateQueries({ queryKey: KEY }); qc.invalidateQueries({ queryKey: ["community_spaces"] }); },
  });
}
