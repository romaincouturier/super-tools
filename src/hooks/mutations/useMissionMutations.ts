/* eslint-disable @typescript-eslint/no-explicit-any */
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Mission,
  CreateMissionInput,
  UpdateMissionInput,
  MissionStatus,
  MissionContact,
} from "@/types/missions";
import {
  MISSIONS_QUERY_KEY,
  MISSION_ACTIVITIES_QUERY_KEY,
  MISSION_PAGES_QUERY_KEY,
  MISSION_PAGE_TEMPLATES_QUERY_KEY,
  MISSION_CONTACTS_QUERY_KEY,
  MissionActivity,
  MissionPage,
  MissionPageTemplate,
} from "@/hooks/queries/useMissionQueries";

// Create mission
export const useCreateMission = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateMissionInput) => {
      const { data: existingMissions } = await (
        supabase as unknown as {
          from: (table: string) => {
            select: (cols: string) => {
              eq: (
                col: string,
                val: string,
              ) => {
                order: (
                  col: string,
                  opts: { ascending: boolean },
                ) => {
                  limit: (
                    n: number,
                  ) => Promise<{ data: Array<{ position: number }> | null; error: Error | null }>;
                };
              };
            };
          };
        }
      )
        .from("missions")
        .select("position")
        .eq("status", input.status || "not_started")
        .order("position", { ascending: false })
        .limit(1);

      const maxPosition = existingMissions?.[0]?.position ?? -1;

      const { data, error } = await (
        supabase as unknown as {
          from: (table: string) => {
            insert: (row: unknown) => {
              select: () => { single: () => Promise<{ data: unknown; error: Error | null }> };
            };
          };
        }
      )
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
      const { data, error } = await (
        supabase as unknown as {
          from: (table: string) => {
            update: (row: unknown) => {
              eq: (
                col: string,
                val: string,
              ) => {
                select: () => { single: () => Promise<{ data: unknown; error: Error | null }> };
              };
            };
          };
        }
      )
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
      const { error } = await (
        supabase as unknown as {
          from: (table: string) => {
            delete: () => { eq: (col: string, val: string) => Promise<{ error: Error | null }> };
          };
        }
      )
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
      const { error } = await (
        supabase as unknown as {
          from: (table: string) => {
            update: (row: unknown) => {
              eq: (col: string, val: string) => Promise<{ error: Error | null }>;
            };
          };
        }
      )
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

// Activity mutations
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

export const useUpdateMissionActivity = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      missionId,
      updates,
    }: {
      id: string;
      missionId: string;
      updates: Partial<MissionActivity>;
    }) => {
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

export const useDeleteMissionActivity = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, missionId }: { id: string; missionId: string }) => {
      const { error } = await (supabase as any).from("mission_activities").delete().eq("id", id);

      if (error) throw error;
      return { missionId };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: [MISSION_ACTIVITIES_QUERY_KEY, data.missionId] });
      queryClient.invalidateQueries({ queryKey: [MISSIONS_QUERY_KEY] });
    },
  });
};

// Page mutations
export const useCreateMissionPage = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: {
      mission_id: string;
      parent_page_id?: string | null;
      title?: string;
      content?: string;
      activity_id?: string | null;
      icon?: string;
    }) => {
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

export const useUpdateMissionPage = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      missionId,
      updates,
    }: {
      id: string;
      missionId: string;
      updates: Partial<MissionPage>;
    }) => {
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

export const useDeleteMissionPage = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, missionId }: { id: string; missionId: string }) => {
      const { error } = await (supabase as any).from("mission_pages").delete().eq("id", id);

      if (error) throw error;
      return { missionId };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: [MISSION_PAGES_QUERY_KEY, data.missionId] });
    },
  });
};

// Page template mutations
export const useCreateMissionPageTemplate = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: {
      name: string;
      description?: string;
      content: string;
      icon?: string;
    }) => {
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

// Contact mutations
export const useCreateMissionContact = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: {
      mission_id: string;
      first_name?: string;
      last_name?: string;
      email?: string;
      phone?: string;
      role?: string;
      language?: string;
      is_primary?: boolean;
    }) => {
      const { data: existing } = await (supabase as any)
        .from("mission_contacts")
        .select("position")
        .eq("mission_id", input.mission_id)
        .order("position", { ascending: false })
        .limit(1);

      const maxPos = existing?.[0]?.position ?? -1;

      if (input.is_primary) {
        await (supabase as any)
          .from("mission_contacts")
          .update({ is_primary: false })
          .eq("mission_id", input.mission_id);
      }

      const { data, error } = await (supabase as any)
        .from("mission_contacts")
        .insert({ ...input, position: maxPos + 1 })
        .select()
        .single();

      if (error) throw error;
      return data as MissionContact;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: [MISSION_CONTACTS_QUERY_KEY, data.mission_id] });
    },
  });
};

export const useUpdateMissionContact = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      missionId,
      updates,
    }: {
      id: string;
      missionId: string;
      updates: Partial<MissionContact>;
    }) => {
      if (updates.is_primary) {
        await (supabase as any)
          .from("mission_contacts")
          .update({ is_primary: false })
          .eq("mission_id", missionId);
      }

      const { data, error } = await (supabase as any)
        .from("mission_contacts")
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return { ...data, missionId } as MissionContact & { missionId: string };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: [MISSION_CONTACTS_QUERY_KEY, data.missionId] });
    },
  });
};

export const useDeleteMissionContact = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, missionId }: { id: string; missionId: string }) => {
      const { error } = await (supabase as any).from("mission_contacts").delete().eq("id", id);

      if (error) throw error;
      return { missionId };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: [MISSION_CONTACTS_QUERY_KEY, data.missionId] });
    },
  });
};
