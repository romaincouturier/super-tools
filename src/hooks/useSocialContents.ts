import { keepPreviousData, useMutation, useQuery, useQueryClient, type QueryKey } from "@tanstack/react-query";
import {
  createTheme,
  deleteGroup,
  deletePost,
  deleteTheme,
  setPostPublished,
  updatePublishedPost,
  getGroup,
  listThemes,
  updateTheme,
  listChannels,
  listGroupsInRange,
  listUndatedGroups,
  saveGroupWithPosts,
  setGroupDate,
  withGroupDate,
  createNote,
  deleteNote,
  listNotesInRange,
  updateNote,
  getProfileLabel,
  searchNewsletterCards,
  validateContent,
  type SocialCalendarNote,
  type SocialContentGroup,
} from "@/services/socialContents";

/** Racine des clés de requête des contenus sociaux (invalidée aussi à la suppression d'un média). */
export const SOCIAL_CONTENTS_KEY = ["social-contents"];
const KEY = SOCIAL_CONTENTS_KEY;
const RANGE_KEY = [...KEY, "range"];
const UNDATED_KEY = [...KEY, "undated"];
const THEMES_KEY = ["social-themes"];

export function useSocialChannels() {
  return useQuery({ queryKey: ["social-channels"], queryFn: listChannels, staleTime: 5 * 60 * 1000 });
}

export function useSocialThemes() {
  return useQuery({ queryKey: THEMES_KEY, queryFn: listThemes });
}

export function useCreateSocialTheme() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: createTheme,
    onSuccess: () => qc.invalidateQueries({ queryKey: THEMES_KEY }),
  });
}

export function useUpdateSocialTheme() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...patch }: { id: string; name?: string; color?: string }) => updateTheme(id, patch),
    onSettled: () => qc.invalidateQueries({ queryKey: THEMES_KEY }),
  });
}

/** Supprimer un thème remet à null le thème de ses contenus : les contenus sont relus. */
export function useDeleteSocialTheme() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: deleteTheme,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: THEMES_KEY });
      qc.invalidateQueries({ queryKey: KEY });
    },
  });
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

/** Marquage publié d'une déclinaison (ou annulation) : les contenus sont relus. */
export function useSetSocialPostPublished() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ postId, published }: { postId: string; published: boolean }) => setPostPublished(postId, published),
    onSettled: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

/** Édition d'une déclinaison publiée, seule. */
export function useUpdatePublishedSocialPost() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ postId, text, mediaId }: { postId: string; text: string; mediaId: string | null }) =>
      updatePublishedPost(postId, text, mediaId),
    onSettled: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

export function useDeleteSocialPost() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: deletePost,
    onSettled: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

export function useDeleteSocialGroup() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: deleteGroup,
    onSettled: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

// ── Notes du calendrier ────────────────────────────────────────

const NOTES_KEY = ["social-calendar-notes"];

export function useSocialCalendarNotes(fromDay: string, toDay: string) {
  return useQuery({
    queryKey: [...NOTES_KEY, fromDay, toDay],
    queryFn: () => listNotesInRange(fromDay, toDay),
    placeholderData: keepPreviousData,
  });
}

export function useCreateSocialNote() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: createNote,
    onSettled: () => qc.invalidateQueries({ queryKey: NOTES_KEY }),
  });
}

interface UpdateNoteVars {
  id: string;
  day?: string;
  text?: string;
  color?: string;
}

type NotePatch = Partial<Pick<SocialCalendarNote, "day" | "text" | "color">>;

const UPDATE_NOTE_KEY = [...NOTES_KEY, "update"];

/**
 * Modification ou déplacement d'une note : mise à jour optimiste. En cas
 * d'erreur, seule la note concernée revient à ses valeurs précédentes, et
 * seulement sur les champs qu'aucune autre modification n'a réécrits depuis.
 * Les notes sont relues une fois la dernière modification en vol terminée.
 */
export function useUpdateSocialNote() {
  const qc = useQueryClient();
  return useMutation({
    mutationKey: UPDATE_NOTE_KEY,
    mutationFn: ({ id, ...patch }: UpdateNoteVars) => updateNote(id, patch),
    onMutate: async ({ id, ...patch }: UpdateNoteVars) => {
      await qc.cancelQueries({ queryKey: NOTES_KEY });
      const current = qc.getQueriesData<SocialCalendarNote[]>({ queryKey: NOTES_KEY })
        .flatMap(([, list]) => list ?? [])
        .find((n) => n.id === id);
      const previous: NotePatch = {};
      if (current) {
        for (const field of Object.keys(patch) as (keyof NotePatch)[]) previous[field] = current[field];
      }
      qc.setQueriesData<SocialCalendarNote[]>({ queryKey: NOTES_KEY }, (list) =>
        list?.map((n) => (n.id === id ? { ...n, ...patch } : n)));
      return { id, patch: patch as NotePatch, previous };
    },
    onError: (_e, _vars, ctx) => {
      if (!ctx) return;
      qc.setQueriesData<SocialCalendarNote[]>({ queryKey: NOTES_KEY }, (list) =>
        list?.map((n) => {
          if (n.id !== ctx.id) return n;
          const restored = { ...n };
          for (const field of Object.keys(ctx.previous) as (keyof NotePatch)[]) {
            const value = ctx.previous[field];
            if (value !== undefined && n[field] === ctx.patch[field]) restored[field] = value;
          }
          return restored;
        }));
    },
    onSettled: () => {
      // La mutation qui se termine compte encore parmi celles en vol.
      if (qc.isMutating({ mutationKey: UPDATE_NOTE_KEY }) <= 1) {
        return qc.invalidateQueries({ queryKey: NOTES_KEY });
      }
    },
  });
}

export function useDeleteSocialNote() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: deleteNote,
    onSettled: () => qc.invalidateQueries({ queryKey: NOTES_KEY }),
  });
}

/** Validation éditoriale d'un contenu (ou son annulation). */
export function useValidateSocialContent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ groupId, validated }: { groupId: string; validated: boolean }) => validateContent(groupId, validated),
    onSettled: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

export function useProfileLabel(userId: string | null | undefined) {
  return useQuery({
    queryKey: ["profile-label", userId],
    queryFn: () => getProfileLabel(userId as string),
    enabled: !!userId,
    staleTime: 10 * 60 * 1000,
  });
}

/** Cartes du kanban Newsletter, chargées seulement quand le sélecteur de source est ouvert. */
export function useNewsletterCards(query: string, enabled: boolean) {
  return useQuery({
    queryKey: ["newsletter-cards-search", query],
    queryFn: () => searchNewsletterCards(query),
    enabled,
  });
}
