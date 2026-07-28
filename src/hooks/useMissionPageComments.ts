import { useQuery, useQueryClient } from "@tanstack/react-query";
import { rpc, type MissionContactByToken, type MissionPageCommentPublic } from "@/lib/supabase-rpc";
import { useEdgeFunction } from "@/hooks/useEdgeFunction";

export const MISSION_PAGE_COMMENTS_QUERY_KEY = "mission-page-comments";
const MISSION_CONTACT_TOKEN_QUERY_KEY = "mission-contact-token";

/** Identité du visiteur, déduite du token `?c=` du lien de livraison. */
export const useMissionContactByToken = (token: string | null) =>
  useQuery({
    queryKey: [MISSION_CONTACT_TOKEN_QUERY_KEY, token],
    queryFn: async (): Promise<MissionContactByToken | null> => {
      const { data, error } = await rpc.getMissionContactByToken(token!);
      if (error) throw error;
      return data;
    },
    enabled: !!token,
    staleTime: Infinity,
    retry: false,
  });

export const useMissionPageComments = (missionId: string | null, enabled = true) =>
  useQuery({
    queryKey: [MISSION_PAGE_COMMENTS_QUERY_KEY, missionId],
    queryFn: async (): Promise<MissionPageCommentPublic[]> => {
      const { data, error } = await rpc.getMissionPageCommentsPublic(missionId!);
      if (error) throw error;
      return data || [];
    },
    enabled: !!missionId && enabled,
  });

export interface AddCommentInput {
  pageId: string;
  body: string;
  blockId?: string | null;
  quotedText?: string | null;
  parentCommentId?: string | null;
}

/**
 * Écritures : tout passe par l'edge function `mission-page-comment`, qui
 * réidentifie l'auteur côté serveur (JWT staff ou token de contact).
 */
export const useMissionPageCommentActions = (missionId: string | null, contactToken: string | null) => {
  const qc = useQueryClient();
  const { loading, invoke } = useEdgeFunction<Record<string, unknown>>("mission-page-comment", {
    errorMessage: "Impossible d'enregistrer le commentaire",
  });

  const refresh = () => qc.invalidateQueries({ queryKey: [MISSION_PAGE_COMMENTS_QUERY_KEY, missionId] });

  const addComment = async (input: AddCommentInput): Promise<boolean> => {
    const result = await invoke({
      action: "create",
      contact_token: contactToken,
      page_id: input.pageId,
      body: input.body,
      block_id: input.blockId ?? null,
      quoted_text: input.quotedText ?? null,
      parent_comment_id: input.parentCommentId ?? null,
    });
    if (result) refresh();
    return !!result;
  };

  const deleteComment = async (commentId: string): Promise<boolean> => {
    const result = await invoke({ action: "delete", contact_token: contactToken, comment_id: commentId });
    if (result) refresh();
    return !!result;
  };

  const resolveThread = async (commentId: string, resolved: boolean): Promise<boolean> => {
    const result = await invoke({ action: "resolve", comment_id: commentId, resolved });
    if (result) refresh();
    return !!result;
  };

  return { loading, addComment, deleteComment, resolveThread };
};
