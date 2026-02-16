import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Mission, CreateMissionInput, UpdateMissionInput, MissionStatus } from "@/types/missions";

const MISSIONS_QUERY_KEY = "missions";
const MISSION_ACTIVITIES_QUERY_KEY = "mission-activities";
const MISSION_PAGES_QUERY_KEY = "mission-pages";
const MISSION_PAGE_TEMPLATES_QUERY_KEY = "mission-page-templates";

// Types for activities and pages
export interface MissionActivity {
  id: string;
  mission_id: string;
  description: string;
  activity_date: string;
  duration_type: "hours" | "days";
  duration: number;
  billable_amount: number | null;
  invoice_url: string | null;
  invoice_number: string | null;
  is_billed: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface MissionPage {
  id: string;
  mission_id: string;
  parent_page_id: string | null;
  activity_id: string | null;
  title: string;
  content: string | null;
  icon: string | null;
  position: number;
  is_expanded: boolean;
  created_at: string;
  updated_at: string;
}

export interface MissionPageTemplate {
  id: string;
  name: string;
  description: string | null;
  content: string;
  icon: string;
  position: number;
  created_at: string;
  updated_at: string;
}

// Fetch all missions
export const useMissions = () => {
  return useQuery({
    queryKey: [MISSIONS_QUERY_KEY],
    queryFn: async () => {
      const { data, error } = await (supabase as unknown as { from: (table: string) => { select: (cols: string) => { order: (col: string, opts: { ascending: boolean }) => Promise<{ data: unknown[] | null; error: Error | null }> } } })
        .from("missions")
        .select("*")
        .order("position", { ascending: true });

      if (error) throw error;
      return (data || []) as Mission[];
    },
  });
};

// Search missions (for referencing in CRM)
export const useSearchMissions = (searchTerm: string) => {
  return useQuery({
    queryKey: [MISSIONS_QUERY_KEY, "search", searchTerm],
    queryFn: async () => {
      if (!searchTerm.trim()) return [];

      const { data, error } = await (supabase as unknown as { from: (table: string) => { select: (cols: string) => { or: (filter: string) => { order: (col: string, opts: { ascending: boolean }) => { limit: (n: number) => Promise<{ data: unknown[] | null; error: Error | null }> } } } } })
        .from("missions")
        .select("id, title, client_name, status, start_date, end_date")
        .or(`title.ilike.%${searchTerm}%,client_name.ilike.%${searchTerm}%`)
        .order("created_at", { ascending: false })
        .limit(10);

      if (error) throw error;
      return (data || []) as Pick<Mission, 'id' | 'title' | 'client_name' | 'status' | 'start_date' | 'end_date'>[];
    },
    enabled: searchTerm.length >= 2,
  });
};

// Create mission
export const useCreateMission = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateMissionInput) => {
      // Get max position for ordering
      const { data: existingMissions } = await (supabase as unknown as { from: (table: string) => { select: (cols: string) => { eq: (col: string, val: string) => { order: (col: string, opts: { ascending: boolean }) => { limit: (n: number) => Promise<{ data: Array<{ position: number }> | null; error: Error | null }> } } } } })
        .from("missions")
        .select("position")
        .eq("status", input.status || "not_started")
        .order("position", { ascending: false })
        .limit(1);

      const maxPosition = existingMissions?.[0]?.position ?? -1;

      const { data, error } = await (supabase as unknown as { from: (table: string) => { insert: (row: unknown) => { select: () => { single: () => Promise<{ data: unknown; error: Error | null }> } } } })
        .from("missions")
        .insert({
          ...input,
          position: maxPosition + 1,
        })
        .select()
        .single();

      if (error) throw error;
      return data as Mission;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [MISSIONS_QUERY_KEY] });
    },
  });
};

// Update mission
export const useUpdateMission = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: UpdateMissionInput }) => {
      const { data, error } = await (supabase as unknown as { from: (table: string) => { update: (row: unknown) => { eq: (col: string, val: string) => { select: () => { single: () => Promise<{ data: unknown; error: Error | null }> } } } } })
        .from("missions")
        .update(updates)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data as Mission;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [MISSIONS_QUERY_KEY] });
    },
  });
};

// Delete mission
export const useDeleteMission = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as unknown as { from: (table: string) => { delete: () => { eq: (col: string, val: string) => Promise<{ error: Error | null }> } } })
        .from("missions")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [MISSIONS_QUERY_KEY] });
    },
  });
};

// Move mission (change status/position)
export const useMoveMission = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      missionId,
      newStatus,
      newPosition,
    }: {
      missionId: string;
      newStatus: MissionStatus;
      newPosition: number;
    }) => {
      const { error } = await (supabase as unknown as { from: (table: string) => { update: (row: unknown) => { eq: (col: string, val: string) => Promise<{ error: Error | null }> } } })
        .from("missions")
        .update({ status: newStatus, position: newPosition })
        .eq("id", missionId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [MISSIONS_QUERY_KEY] });
    },
  });
};

// ===============================
// Mission Activities Hooks
// ===============================

// Fetch activities for a mission
export const useMissionActivities = (missionId: string | null) => {
  return useQuery({
    queryKey: [MISSION_ACTIVITIES_QUERY_KEY, missionId],
    queryFn: async () => {
      if (!missionId) return [];

      const { data, error } = await (supabase as any)
        .from("mission_activities")
        .select("*")
        .eq("mission_id", missionId)
        .order("activity_date", { ascending: false });

      if (error) throw error;
      return (data || []) as MissionActivity[];
    },
    enabled: !!missionId,
  });
};

// Create activity
export const useCreateMissionActivity = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: Omit<MissionActivity, "id" | "created_at" | "updated_at">) => {
      const { data, error } = await (supabase as any)
        .from("mission_activities")
        .insert(input)
        .select()
        .single();

      if (error) throw error;
      return data as MissionActivity;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: [MISSION_ACTIVITIES_QUERY_KEY, data.mission_id] });
      queryClient.invalidateQueries({ queryKey: [MISSIONS_QUERY_KEY] });
    },
  });
};

// Update activity
export const useUpdateMissionActivity = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, missionId, updates }: { id: string; missionId: string; updates: Partial<MissionActivity> }) => {
      const { data, error } = await (supabase as any)
        .from("mission_activities")
        .update(updates)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return { ...data, missionId } as MissionActivity & { missionId: string };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: [MISSION_ACTIVITIES_QUERY_KEY, data.missionId] });
      queryClient.invalidateQueries({ queryKey: [MISSIONS_QUERY_KEY] });
    },
  });
};

// Delete activity
export const useDeleteMissionActivity = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, missionId }: { id: string; missionId: string }) => {
      const { error } = await (supabase as any)
        .from("mission_activities")
        .delete()
        .eq("id", id);

      if (error) throw error;
      return { missionId };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: [MISSION_ACTIVITIES_QUERY_KEY, data.missionId] });
      queryClient.invalidateQueries({ queryKey: [MISSIONS_QUERY_KEY] });
    },
  });
};

// ===============================
// Mission Pages Hooks
// ===============================

// Fetch pages for a mission
export const useMissionPages = (missionId: string | null) => {
  return useQuery({
    queryKey: [MISSION_PAGES_QUERY_KEY, missionId],
    queryFn: async () => {
      if (!missionId) return [];

      const { data, error } = await (supabase as any)
        .from("mission_pages")
        .select("*")
        .eq("mission_id", missionId)
        .order("position", { ascending: true });

      if (error) throw error;
      return (data || []) as MissionPage[];
    },
    enabled: !!missionId,
  });
};

// Create page
export const useCreateMissionPage = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: { mission_id: string; parent_page_id?: string | null; title?: string; content?: string; activity_id?: string | null; icon?: string }) => {
      // Get max position
      const { data: existingPages } = await (supabase as any)
        .from("mission_pages")
        .select("position")
        .eq("mission_id", input.mission_id)
        .eq("parent_page_id", input.parent_page_id || null)
        .order("position", { ascending: false })
        .limit(1);

      const maxPosition = existingPages?.[0]?.position ?? -1;

      const { data, error } = await (supabase as any)
        .from("mission_pages")
        .insert({
          mission_id: input.mission_id,
          parent_page_id: input.parent_page_id || null,
          title: input.title || "Sans titre",
          content: input.content || null,
          activity_id: input.activity_id || null,
          icon: input.icon || null,
          position: maxPosition + 1,
        })
        .select()
        .single();

      if (error) throw error;
      return data as MissionPage;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: [MISSION_PAGES_QUERY_KEY, data.mission_id] });
    },
  });
};

// Update page
export const useUpdateMissionPage = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, missionId, updates }: { id: string; missionId: string; updates: Partial<MissionPage> }) => {
      const { data, error } = await (supabase as any)
        .from("mission_pages")
        .update(updates)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return { ...data, missionId } as MissionPage & { missionId: string };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: [MISSION_PAGES_QUERY_KEY, data.missionId] });
    },
  });
};

// Delete page
export const useDeleteMissionPage = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, missionId }: { id: string; missionId: string }) => {
      const { error } = await (supabase as any)
        .from("mission_pages")
        .delete()
        .eq("id", id);

      if (error) throw error;
      return { missionId };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: [MISSION_PAGES_QUERY_KEY, data.missionId] });
    },
  });
};

// ===============================
// Mission Page Templates Hooks
// ===============================

export const useMissionPageTemplates = () => {
  return useQuery({
    queryKey: [MISSION_PAGE_TEMPLATES_QUERY_KEY],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("mission_page_templates")
        .select("*")
        .order("position", { ascending: true });

      if (error) throw error;
      return (data || []) as MissionPageTemplate[];
    },
  });
};

export const useCreateMissionPageTemplate = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: { name: string; description?: string; content: string; icon?: string }) => {
      const { data: existing } = await (supabase as any)
        .from("mission_page_templates")
        .select("position")
        .order("position", { ascending: false })
        .limit(1);

      const maxPos = existing?.[0]?.position ?? -1;

      const { data, error } = await (supabase as any)
        .from("mission_page_templates")
        .insert({ ...input, position: maxPos + 1 })
        .select()
        .single();

      if (error) throw error;
      return data as MissionPageTemplate;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [MISSION_PAGE_TEMPLATES_QUERY_KEY] });
    },
  });
};

export const useUpdateMissionPageTemplate = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<MissionPageTemplate> }) => {
      const { data, error } = await (supabase as any)
        .from("mission_page_templates")
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data as MissionPageTemplate;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [MISSION_PAGE_TEMPLATES_QUERY_KEY] });
    },
  });
};

export const useDeleteMissionPageTemplate = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any)
        .from("mission_page_templates")
        .delete()
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [MISSION_PAGE_TEMPLATES_QUERY_KEY] });
    },
  });
};
