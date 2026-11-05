import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getGroup, listChannels, saveGroupWithPosts } from "@/services/socialContents";

const KEY = ["social-contents"];

export function useSocialChannels() {
  return useQuery({ queryKey: ["social-channels"], queryFn: listChannels, staleTime: 5 * 60 * 1000 });
}

export function useSocialGroup(id: string | null) {
  return useQuery({
    queryKey: [...KEY, "group", id],
    queryFn: () => getGroup(id as string),
    enabled: !!id,
  });
}

export function useSaveSocialGroup() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: saveGroupWithPosts,
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}
