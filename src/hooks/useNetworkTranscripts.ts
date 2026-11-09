import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { NetworkContact, WarmthLevel } from "@/types/reseau";
import { CONTACTS_KEY } from "./useReseauContacts";
import { INTERACTIONS_KEY } from "./useReseauInteractions";
import { TRANSCRIPT_ASSIGNMENTS_KEY } from "./useTranscriptAssignments";

export const NETWORK_TRANSCRIPTS_KEY = "network-contact-transcripts";

export function transcriptUrl(transcriptId: string): string {
  return `${window.location.origin}/supertilt-fr/transcripts?transcript=${transcriptId}`;
}

export interface NetworkContactTranscript {
  id: string;
  transcript_id: string;
  created_at: string;
  transcript: {
    id: string;
    title: string | null;
    ai_title: string | null;
    summary: string | null;
    source: string;
    created_at: string;
    metadata: Record<string, unknown> | null;
  } | null;
}

export function useNetworkContactTranscripts(contactId: string | null) {
  return useQuery({
    queryKey: [NETWORK_TRANSCRIPTS_KEY, contactId],
    enabled: !!contactId,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("network_contact_transcripts")
        .select("id, transcript_id, created_at, transcript:transcripts(id, title, ai_title, summary, source, created_at, metadata)")
        .eq("contact_id", contactId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as NetworkContactTranscript[];
    },
  });
}

export interface NewNetworkContactInput {
  name: string;
  context?: string;
  warmth: WarmthLevel;
  linkedin_url?: string;
}

/**
 * Rattache un transcript à un contact Réseau (existant ou créé à la volée) :
 * lien, interaction « meeting » avec résumé et lien, date de dernier contact.
 */
export function useLinkTranscriptToNetworkContact() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { transcriptId: string; contactId?: string; newContact?: NewNetworkContactInput }) => {
      let contactId = input.contactId;
      if (!contactId) {
        if (!input.newContact?.name.trim()) throw new Error("Nom du contact requis");
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error("Non authentifié");
        const c = input.newContact;
        const { data, error } = await supabase
          .from("network_contacts")
          .insert({
            user_id: user.id,
            name: c.name.trim(),
            context: c.context?.trim() || null,
            warmth: c.warmth,
            linkedin_url: c.linkedin_url?.trim() || null,
          })
          .select()
          .single();
        if (error) throw error;
        contactId = (data as NetworkContact).id;
      }
      const { data, error } = await (supabase as any).rpc("link_transcript_to_network_contact", {
        p_contact_id: contactId,
        p_transcript_id: input.transcriptId,
        p_transcript_url: transcriptUrl(input.transcriptId),
      });
      if (error) throw error;
      return data as { status: "assigned" | "already_assigned" };
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: TRANSCRIPT_ASSIGNMENTS_KEY });
      qc.invalidateQueries({ queryKey: [CONTACTS_KEY] });
      qc.invalidateQueries({ queryKey: [INTERACTIONS_KEY] });
      qc.invalidateQueries({ queryKey: [NETWORK_TRANSCRIPTS_KEY] });
    },
  });
}
