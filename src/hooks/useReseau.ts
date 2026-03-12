import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type {
  NetworkContact,
  UserPositioning,
  NetworkMessage,
  ConversationPhase,
  NetworkAIResponse,
  WarmthLevel,
} from "@/types/reseau";

const POSITIONING_KEY = "network-positioning";
const CONTACTS_KEY = "network-contacts";
const CONVERSATION_KEY = "network-conversation";

// ─── Positioning ───

export const usePositioning = () => {
  return useQuery({
    queryKey: [POSITIONING_KEY],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Non authentifié");

      const { data, error } = await (supabase as any)
        .from("user_positioning")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();
      if (error) throw error;
      return data as UserPositioning | null;
    },
  });
};

export const useUpsertPositioning = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      pitch_one_liner: string;
      key_skills: string[];
      target_client: string;
    }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Non authentifié");

      const { data, error } = await (supabase as any)
        .from("user_positioning")
        .upsert(
          {
            user_id: user.id,
            ...input,
            onboarding_completed_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
          { onConflict: "user_id" }
        )
        .select()
        .single();
      if (error) throw error;
      return data as UserPositioning;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [POSITIONING_KEY] });
    },
  });
};

// ─── Contacts ───

export const useNetworkContacts = () => {
  return useQuery({
    queryKey: [CONTACTS_KEY],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Non authentifié");

      const { data, error } = await (supabase as any)
        .from("network_contacts")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as NetworkContact[];
    },
  });
};

export const useCreateContact = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      name: string;
      context?: string;
      warmth: WarmthLevel;
      linkedin_url?: string;
      notes?: string;
    }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Non authentifié");

      const { data, error } = await (supabase as any)
        .from("network_contacts")
        .insert({ user_id: user.id, ...input })
        .select()
        .single();
      if (error) throw error;
      return data as NetworkContact;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [CONTACTS_KEY] });
    },
  });
};

export const useUpdateContact = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...input }: Partial<NetworkContact> & { id: string }) => {
      const { data, error } = await (supabase as any)
        .from("network_contacts")
        .update(input)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data as NetworkContact;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [CONTACTS_KEY] });
    },
  });
};

export const useDeleteContact = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any)
        .from("network_contacts")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [CONTACTS_KEY] });
    },
  });
};

// ─── Conversation ───

export const useNetworkConversation = (phase: ConversationPhase) => {
  return useQuery({
    queryKey: [CONVERSATION_KEY, phase],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Non authentifié");

      const { data, error } = await (supabase as any)
        .from("network_conversation")
        .select("*")
        .eq("user_id", user.id)
        .eq("phase", phase)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data || []) as NetworkMessage[];
    },
  });
};

export const useSendNetworkMessage = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      content,
      phase,
      positioning,
      contacts,
    }: {
      content: string;
      phase: ConversationPhase;
      positioning?: UserPositioning | null;
      contacts?: NetworkContact[];
    }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Non authentifié");

      // Save user message
      await (supabase as any)
        .from("network_conversation")
        .insert({ user_id: user.id, role: "user", content, phase });

      // Get full conversation history
      const { data: history } = await (supabase as any)
        .from("network_conversation")
        .select("role, content")
        .eq("user_id", user.id)
        .eq("phase", phase)
        .order("created_at", { ascending: true });

      // Call edge function
      const { data, error } = await supabase.functions.invoke("network-ai-assistant", {
        body: {
          messages: history || [],
          phase,
          positioning: positioning || undefined,
          contacts: contacts || undefined,
        },
      });

      if (error) throw error;
      const aiResponse = data as NetworkAIResponse;

      // Save assistant message
      await (supabase as any)
        .from("network_conversation")
        .insert({ user_id: user.id, role: "assistant", content: aiResponse.reply, phase });

      return aiResponse;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: [CONVERSATION_KEY, variables.phase] });
    },
  });
};
