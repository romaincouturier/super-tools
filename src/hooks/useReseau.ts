import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type {
  NetworkContact,
  NetworkAction,
  UserPositioning,
  NetworkMessage,
  ConversationPhase,
  NetworkAIResponse,
  GeneratedAction,
  CoolingContact,
  CoolingThresholds,
  NetworkStats,
  NetworkInteraction,
  WarmthLevel,
} from "@/types/reseau";
import { useMemo } from "react";

const POSITIONING_KEY = "network-positioning";
const CONTACTS_KEY = "network-contacts";
const CONVERSATION_KEY = "network-conversation";
const ACTIONS_KEY = "network-actions";
const INTERACTIONS_KEY = "network-interactions";

const DEFAULT_THRESHOLDS: CoolingThresholds = { hot: 14, warm: 30, cold: 60 };

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

// ─── Actions ───

export const useNetworkActions = (week?: string) => {
  return useQuery({
    queryKey: [ACTIONS_KEY, week],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Non authentifié");

      let query = (supabase as any)
        .from("network_actions")
        .select("*, contact:network_contacts(*)")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (week) {
        query = query.eq("scheduled_week", week);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as (NetworkAction & { contact: NetworkContact | null })[];
    },
  });
};

export const useGenerateWeeklyActions = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      positioning,
      contacts,
    }: {
      positioning: UserPositioning;
      contacts: NetworkContact[];
    }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Non authentifié");

      const { data, error } = await supabase.functions.invoke("network-generate-actions", {
        body: { positioning, contacts },
      });
      if (error) throw error;

      const generated = (data as { actions: GeneratedAction[] }).actions;
      const today = new Date().toISOString().split("T")[0];

      // Save generated actions to DB
      if (generated.length > 0) {
        const rows = generated.map((a) => ({
          user_id: user.id,
          contact_id: a.contact_id,
          action_type: a.action_type,
          message_draft: a.message_draft,
          scheduled_week: today,
          status: "pending" as const,
        }));

        await (supabase as any).from("network_actions").insert(rows);
      }

      return generated;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [ACTIONS_KEY] });
    },
  });
};

export const useUpdateActionStatus = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, status, result, contactId, actionType }: {
      id: string;
      status: "done" | "skipped";
      result?: string;
      contactId?: string;
      actionType?: string;
    }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Non authentifié");

      const { error } = await (supabase as any)
        .from("network_actions")
        .update({
          status,
          result: result || null,
          done_at: status === "done" ? new Date().toISOString() : null,
        })
        .eq("id", id);
      if (error) throw error;

      // Auto-log interaction when action is marked as done
      if (status === "done" && contactId) {
        await (supabase as any)
          .from("network_interactions")
          .insert({
            user_id: user.id,
            contact_id: contactId,
            interaction_type: actionType || "other",
            notes: `Action complétée${result ? `: ${result}` : ""}`,
          });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [ACTIONS_KEY] });
      queryClient.invalidateQueries({ queryKey: [CONTACTS_KEY] });
      queryClient.invalidateQueries({ queryKey: [INTERACTIONS_KEY] });
    },
  });
};

// ─── Conversation ───

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

// ─── Interactions ───

export const useLogInteraction = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      contact_id: string;
      interaction_type: string;
      notes?: string;
    }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Non authentifié");

      const { error } = await (supabase as any)
        .from("network_interactions")
        .insert({ user_id: user.id, ...input });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [CONTACTS_KEY] });
      queryClient.invalidateQueries({ queryKey: [INTERACTIONS_KEY] });
    },
  });
};

// ─── Cooling Detection ───

export const useCoolingContacts = (
  contacts: NetworkContact[],
  positioning: UserPositioning | null,
) => {
  return useMemo(() => {
    const thresholds: CoolingThresholds = (positioning as any)?.cooling_thresholds || DEFAULT_THRESHOLDS;
    const now = new Date();
    const cooling: CoolingContact[] = [];

    for (const contact of contacts) {
      const threshold = thresholds[contact.warmth];
      if (!contact.last_contact_date) {
        // No interaction ever — use created_at
        const daysSince = Math.floor(
          (now.getTime() - new Date(contact.created_at).getTime()) / (1000 * 60 * 60 * 24)
        );
        if (daysSince >= threshold * 0.7) {
          cooling.push({
            contact,
            daysSinceLastContact: daysSince,
            threshold,
            isOverdue: daysSince >= threshold,
          });
        }
      } else {
        const daysSince = Math.floor(
          (now.getTime() - new Date(contact.last_contact_date).getTime()) / (1000 * 60 * 60 * 24)
        );
        if (daysSince >= threshold * 0.7) {
          cooling.push({
            contact,
            daysSinceLastContact: daysSince,
            threshold,
            isOverdue: daysSince >= threshold,
          });
        }
      }
    }

    // Sort: overdue first, then by days since last contact descending
    cooling.sort((a, b) => {
      if (a.isOverdue !== b.isOverdue) return a.isOverdue ? -1 : 1;
      return b.daysSinceLastContact - a.daysSinceLastContact;
    });

    return cooling;
  }, [contacts, positioning]);
};

// ─── Interactions Query ───

export const useNetworkInteractions = () => {
  return useQuery({
    queryKey: [INTERACTIONS_KEY],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Non authentifié");

      const { data, error } = await (supabase as any)
        .from("network_interactions")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as NetworkInteraction[];
    },
  });
};

// ─── Network Stats ───

export const useNetworkStats = (
  contacts: NetworkContact[],
  actions: (NetworkAction & { contact: NetworkContact | null })[],
  interactions: NetworkInteraction[],
): NetworkStats => {
  return useMemo(() => {
    const now = new Date();
    const d7ago = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const d30ago = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    // Warmth distribution
    const warmthDistribution: Record<WarmthLevel, number> = { hot: 0, warm: 0, cold: 0 };
    for (const c of contacts) warmthDistribution[c.warmth]++;
    const total = contacts.length || 1;
    const warmthPercent: Record<WarmthLevel, number> = {
      hot: Math.round((warmthDistribution.hot / total) * 100),
      warm: Math.round((warmthDistribution.warm / total) * 100),
      cold: Math.round((warmthDistribution.cold / total) * 100),
    };

    // Actions stats
    const actionsDone = actions.filter((a) => a.status === "done").length;
    const actionsSkipped = actions.filter((a) => a.status === "skipped").length;
    const actionsPending = actions.filter((a) => a.status === "pending").length;
    const completedOrSkipped = actionsDone + actionsSkipped;
    const completionRate = completedOrSkipped > 0 ? Math.round((actionsDone / completedOrSkipped) * 100) : 0;

    // Interactions timeline
    const interactionsLast7d = interactions.filter((i) => new Date(i.created_at) >= d7ago).length;
    const interactionsLast30d = interactions.filter((i) => new Date(i.created_at) >= d30ago).length;

    // Weekly activity (last 8 weeks)
    const weeklyActivity: { week: string; count: number }[] = [];
    for (let w = 7; w >= 0; w--) {
      const weekStart = new Date(now.getTime() - (w * 7 + 6) * 24 * 60 * 60 * 1000);
      const weekEnd = new Date(now.getTime() - w * 7 * 24 * 60 * 60 * 1000);
      const count = interactions.filter((i) => {
        const d = new Date(i.created_at);
        return d >= weekStart && d < weekEnd;
      }).length;
      const label = `S-${w}`;
      weeklyActivity.push({ week: w === 0 ? "Cette sem." : label, count });
    }

    // Average days since contact
    let totalDays = 0;
    let contactsNeverContacted = 0;
    for (const c of contacts) {
      if (c.last_contact_date) {
        totalDays += Math.floor(
          (now.getTime() - new Date(c.last_contact_date).getTime()) / (1000 * 60 * 60 * 24)
        );
      } else {
        contactsNeverContacted++;
        totalDays += Math.floor(
          (now.getTime() - new Date(c.created_at).getTime()) / (1000 * 60 * 60 * 24)
        );
      }
    }
    const averageDaysSinceContact = contacts.length > 0 ? Math.round(totalDays / contacts.length) : 0;

    // Network health score (0-100)
    // Factors: hot%, completion rate, recent interactions, low cooling
    const hotPercent = warmthPercent.hot;
    const recentActivityScore = Math.min(interactionsLast7d * 20, 100);
    const neverContactedPenalty = contacts.length > 0
      ? Math.round((contactsNeverContacted / contacts.length) * 100)
      : 0;
    const networkHealthScore = Math.min(100, Math.max(0, Math.round(
      (hotPercent * 0.3) + (completionRate * 0.3) + (recentActivityScore * 0.25) + ((100 - neverContactedPenalty) * 0.15)
    )));

    return {
      totalContacts: contacts.length,
      warmthDistribution,
      warmthPercent,
      totalActions: actions.length,
      actionsDone,
      actionsSkipped,
      actionsPending,
      completionRate,
      totalInteractions: interactions.length,
      interactionsLast7d,
      interactionsLast30d,
      weeklyActivity,
      averageDaysSinceContact,
      contactsNeverContacted,
      networkHealthScore,
    };
  }, [contacts, actions, interactions]);
};
