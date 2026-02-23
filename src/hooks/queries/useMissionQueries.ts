/* eslint-disable @typescript-eslint/no-explicit-any */
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Mission, MissionContact } from "@/types/missions";

export const MISSIONS_QUERY_KEY = "missions";
export const MISSION_ACTIVITIES_QUERY_KEY = "mission-activities";
export const MISSION_PAGES_QUERY_KEY = "mission-pages";
export const MISSION_PAGE_TEMPLATES_QUERY_KEY = "mission-page-templates";
export const MISSION_CONTACTS_QUERY_KEY = "mission-contacts";

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
      const { data, error } = await (
        supabase as unknown as {
          from: (table: string) => {
            select: (cols: string) => {
              order: (
                col: string,
                opts: { ascending: boolean },
              ) => Promise<{ data: unknown[] | null; error: Error | null }>;
            };
          };
        }
      )
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

      const { data, error } = await (
        supabase as unknown as {
          from: (table: string) => {
            select: (cols: string) => {
              or: (filter: string) => {
                order: (
                  col: string,
                  opts: { ascending: boolean },
                ) => {
                  limit: (n: number) => Promise<{ data: unknown[] | null; error: Error | null }>;
                };
              };
            };
          };
        }
      )
        .from("missions")
        .select("id, title, client_name, status, start_date, end_date")
        .or(`title.ilike.%${searchTerm}%,client_name.ilike.%${searchTerm}%`)
        .order("created_at", { ascending: false })
        .limit(10);

      if (error) throw error;
      return (data || []) as Pick<
        Mission,
        "id" | "title" | "client_name" | "status" | "start_date" | "end_date"
      >[];
    },
    enabled: searchTerm.length >= 2,
  });
};

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

// Fetch page templates
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

// Fetch contacts for a mission
export const useMissionContacts = (missionId: string | null) => {
  return useQuery({
    queryKey: [MISSION_CONTACTS_QUERY_KEY, missionId],
    queryFn: async () => {
      if (!missionId) return [];

      const { data, error } = await (supabase as any)
        .from("mission_contacts")
        .select("*")
        .eq("mission_id", missionId)
        .order("is_primary", { ascending: false })
        .order("position", { ascending: true });

      if (error) throw error;
      return (data || []) as MissionContact[];
    },
    enabled: !!missionId,
  });
};
