/**
 * React Query hooks for the Missions module.
 * All DB logic lives in src/services/missions.ts — hooks are thin wrappers.
 */
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Mission, CreateMissionInput, UpdateMissionInput, MissionStatus, MissionContact } from "@/types/missions";
import * as missionService from "@/services/missions";

const MISSIONS_QUERY_KEY = "missions";
const MISSION_ACTIVITIES_QUERY_KEY = "mission-activities";
const MISSION_PAGES_QUERY_KEY = "mission-pages";
const MISSION_PAGE_TEMPLATES_QUERY_KEY = "mission-page-templates";
const MISSION_CONTACTS_QUERY_KEY = "mission-contacts";

// Re-export types that were previously defined here (backward compat)
export type { MissionContact } from "@/types/missions";

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
  google_event_id: string | null;
  google_event_link: string | null;
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

// ── Mission hooks ────────────────────────────────────────────────────

export const useMissions = () =>
  useQuery({
    queryKey: [MISSIONS_QUERY_KEY],
    queryFn: missionService.fetchMissions,
  });

export const useSearchMissions = (searchTerm: string) =>
  useQuery({
    queryKey: [MISSIONS_QUERY_KEY, "search", searchTerm],
    queryFn: () => missionService.searchMissions(searchTerm),
    enabled: searchTerm.length >= 2,
  });

export const useCreateMission = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateMissionInput) => missionService.createMission(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: [MISSIONS_QUERY_KEY] }),
  });
};

export const useUpdateMission = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: UpdateMissionInput }) =>
      missionService.updateMission(id, updates),
    onSuccess: () => qc.invalidateQueries({ queryKey: [MISSIONS_QUERY_KEY] }),
  });
};

export const useDeleteMission = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => missionService.deleteMission(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: [MISSIONS_QUERY_KEY] }),
  });
};

export const useMoveMission = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ missionId, newStatus, newPosition }: { missionId: string; newStatus: MissionStatus; newPosition: number }) =>
      missionService.moveMission(missionId, newStatus, newPosition),
    onSuccess: () => qc.invalidateQueries({ queryKey: [MISSIONS_QUERY_KEY] }),
  });
};

// ── Activity hooks ───────────────────────────────────────────────────

export const useMissionActivities = (missionId: string | null) =>
  useQuery({
    queryKey: [MISSION_ACTIVITIES_QUERY_KEY, missionId],
    queryFn: () => missionService.fetchActivities(missionId!),
    enabled: !!missionId,
  });

export const useCreateMissionActivity = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: Omit<MissionActivity, "id" | "created_at" | "updated_at">) =>
      missionService.createActivity(input),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: [MISSION_ACTIVITIES_QUERY_KEY, data.mission_id] });
      qc.invalidateQueries({ queryKey: [MISSIONS_QUERY_KEY] });
    },
  });
};

export const useUpdateMissionActivity = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, missionId, updates }: { id: string; missionId: string; updates: Partial<MissionActivity> }) =>
      missionService.updateActivity(id, updates).then((d) => ({ ...d, missionId })),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: [MISSION_ACTIVITIES_QUERY_KEY, data.missionId] });
      qc.invalidateQueries({ queryKey: [MISSIONS_QUERY_KEY] });
    },
  });
};

export const useDeleteMissionActivity = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, missionId }: { id: string; missionId: string }) => {
      await missionService.deleteActivity(id);
      return { missionId };
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: [MISSION_ACTIVITIES_QUERY_KEY, data.missionId] });
      qc.invalidateQueries({ queryKey: [MISSIONS_QUERY_KEY] });
    },
  });
};

// ── Page hooks ───────────────────────────────────────────────────────

export const useMissionPages = (missionId: string | null) =>
  useQuery({
    queryKey: [MISSION_PAGES_QUERY_KEY, missionId],
    queryFn: () => missionService.fetchPages(missionId!),
    enabled: !!missionId,
  });

export const useCreateMissionPage = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { mission_id: string; parent_page_id?: string | null; title?: string; content?: string; activity_id?: string | null; icon?: string }) =>
      missionService.createPage(input),
    onSuccess: (data) => qc.invalidateQueries({ queryKey: [MISSION_PAGES_QUERY_KEY, data.mission_id] }),
  });
};

export const useUpdateMissionPage = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, missionId, updates }: { id: string; missionId: string; updates: Partial<MissionPage> }) =>
      missionService.updatePage(id, updates).then((d) => ({ ...d, missionId })),
    onSuccess: (data) => qc.invalidateQueries({ queryKey: [MISSION_PAGES_QUERY_KEY, data.missionId] }),
  });
};

export const useDeleteMissionPage = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, missionId }: { id: string; missionId: string }) => {
      await missionService.deletePage(id);
      return { missionId };
    },
    onSuccess: (data) => qc.invalidateQueries({ queryKey: [MISSION_PAGES_QUERY_KEY, data.missionId] }),
  });
};

// ── Page Template hooks ──────────────────────────────────────────────

export const useMissionPageTemplates = () =>
  useQuery({
    queryKey: [MISSION_PAGE_TEMPLATES_QUERY_KEY],
    queryFn: missionService.fetchPageTemplates,
  });

export const useCreateMissionPageTemplate = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { name: string; description?: string; content: string; icon?: string }) =>
      missionService.createPageTemplate(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: [MISSION_PAGE_TEMPLATES_QUERY_KEY] }),
  });
};

export const useUpdateMissionPageTemplate = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Partial<MissionPageTemplate> }) =>
      missionService.updatePageTemplate(id, updates),
    onSuccess: () => qc.invalidateQueries({ queryKey: [MISSION_PAGE_TEMPLATES_QUERY_KEY] }),
  });
};

export const useDeleteMissionPageTemplate = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => missionService.deletePageTemplate(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: [MISSION_PAGE_TEMPLATES_QUERY_KEY] }),
  });
};

// ── Contact hooks ────────────────────────────────────────────────────

export const useMissionContacts = (missionId: string | null) =>
  useQuery({
    queryKey: [MISSION_CONTACTS_QUERY_KEY, missionId],
    queryFn: () => missionService.fetchContacts(missionId!),
    enabled: !!missionId,
  });

export const useCreateMissionContact = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { mission_id: string; first_name?: string; last_name?: string; email?: string; phone?: string; role?: string; language?: string; is_primary?: boolean }) =>
      missionService.createContact(input),
    onSuccess: (data) => qc.invalidateQueries({ queryKey: [MISSION_CONTACTS_QUERY_KEY, data.mission_id] }),
  });
};

export const useUpdateMissionContact = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, missionId, updates }: { id: string; missionId: string; updates: Partial<MissionContact> }) =>
      missionService.updateContact(id, missionId, updates).then((d) => ({ ...d, missionId })),
    onSuccess: (data) => qc.invalidateQueries({ queryKey: [MISSION_CONTACTS_QUERY_KEY, data.missionId] }),
  });
};

export const useDeleteMissionContact = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, missionId }: { id: string; missionId: string }) => {
      await missionService.deleteContact(id);
      return { missionId };
    },
    onSuccess: (data) => qc.invalidateQueries({ queryKey: [MISSION_CONTACTS_QUERY_KEY, data.missionId] }),
  });
};
