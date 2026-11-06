import { keepPreviousData, useMutation, useQuery, useQueryClient, type QueryKey } from "@tanstack/react-query";
import {
  getGroup,
  listChannels,
  listGroupsInRange,
  listUndatedGroups,
  saveGroupWithPosts,
  setGroupDate,
  withGroupDate,
  type SocialContentGroup,
} from "@/services/socialContents";

/** Racine des clés de requête des contenus sociaux (invalidée aussi à la suppression d'un média). */
export const SOCIAL_CONTENTS_KEY = ["social-contents"];
const KEY = SOCIAL_CONTENTS_KEY;
const RANGE_KEY = [...KEY, "range"];
const UNDATED_KEY = [...KEY, "undated"];

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

export function useSocialGroupsInRange(fromIso: string, toIso: string) {
  return useQuery({
    queryKey: [...RANGE_KEY, fromIso, toIso],
    queryFn: () => listGroupsInRange(fromIso, toIso),
    placeholderData: keepPreviousData,
  });
}

export function useUndatedSocialGroups() {
  return useQuery({ queryKey: UNDATED_KEY, queryFn: listUndatedGroups });
}

export function useSaveSocialGroup() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: saveGroupWithPosts,
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

interface SetDateVars {
  groupId: string;
  scheduledAt: string | null;
}

/** Date d'un contenu : mise à jour optimiste des listes du calendrier, retour arrière en cas d'erreur. */
export function useSetSocialGroupDate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ groupId, scheduledAt }: SetDateVars) => setGroupDate(groupId, scheduledAt),
    onMutate: async ({ groupId, scheduledAt }: SetDateVars) => {
      await qc.cancelQueries({ queryKey: KEY });
      const snapshot: [QueryKey, SocialContentGroup[] | undefined][] = [
        ...qc.getQueriesData<SocialContentGroup[]>({ queryKey: RANGE_KEY }),
        ...qc.getQueriesData<SocialContentGroup[]>({ queryKey: UNDATED_KEY }),
      ];
      const update = (list: SocialContentGroup[] | undefined) =>
        list?.map((g) => (g.id === groupId ? withGroupDate(g, scheduledAt) : g));
      qc.setQueriesData<SocialContentGroup[]>({ queryKey: RANGE_KEY }, update);
      qc.setQueriesData<SocialContentGroup[]>({ queryKey: UNDATED_KEY }, update);
      return { snapshot };
    },
    onError: (_e, _vars, ctx) => {
      ctx?.snapshot.forEach(([key, data]) => qc.setQueryData(key, data));
    },
    onSettled: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}
