/**
 * Mission service — centralizes all Supabase DB calls for missions domain.
 * Hooks in useMissions.ts become thin React Query wrappers around these functions.
 */
import { db, throwIfError, getMaxPosition } from "@/lib/supabase-helpers";
import { todayAsISO } from "@/lib/dateFormatters";
import type { Mission, CreateMissionInput, UpdateMissionInput, MissionStatus, MissionContact } from "@/types/missions";
import type { MissionActivity, MissionPage, MissionPageTemplate } from "@/hooks/useMissions";
import type { KanbanRepository } from "./repository";

// ── Missions CRUD ────────────────────────────────────────────────────

export async function fetchMissions(): Promise<Mission[]> {
  const result = await db().from("missions").select("*").order("position", { ascending: true });
  return (throwIfError(result) || []) as Mission[];
}

export async function fetchMissionById(id: string): Promise<Mission> {
  const result = await db().from("missions").select("*").eq("id", id).single();
  return throwIfError(result) as Mission;
}

/** Escape special PostgREST filter characters to prevent injection in .or() */
function escapeFilterValue(value: string): string {
  return value.replace(/[%_\\,()."]/g, (ch) => `\\${ch}`);
}

export async function searchMissions(term: string): Promise<Pick<Mission, "id" | "title" | "client_name" | "client_contact" | "status" | "start_date" | "end_date">[]> {
  if (!term.trim()) return [];
  const safe = escapeFilterValue(term.trim());
  const result = await db()
    .from("missions")
    .select("id, title, client_name, client_contact, status, start_date, end_date")
    .or(`title.ilike.%${safe}%,client_name.ilike.%${safe}%,client_contact.ilike.%${safe}%`)
    .order("created_at", { ascending: false })
    .limit(10);
  return (throwIfError(result) || []) as Pick<Mission, "id" | "title" | "client_name" | "client_contact" | "status" | "start_date" | "end_date">[];
}

export async function createMission(input: CreateMissionInput): Promise<Mission> {
  const maxPosition = await getMaxPosition("missions", { status: input.status || "not_started" });

  const { contact_first_name, contact_last_name, contact_email, contact_phone, ...missionData } = input;

  const result = await db()
    .from("missions")
    .insert({ ...missionData, position: maxPosition + 1 })
    .select()
    .single();

  const mission = throwIfError(result) as Mission;

  // Auto-create contact
  const hasStructured = input.contact_first_name || input.contact_last_name || input.contact_email || input.contact_phone;
  if (hasStructured) {
    await db().from("mission_contacts").insert({
      mission_id: mission.id,
      first_name: input.contact_first_name || null,
      last_name: input.contact_last_name || null,
      email: input.contact_email || null,
      phone: input.contact_phone || null,
      is_primary: true,
      language: "fr",
      position: 0,
    });
  } else if (input.client_contact?.trim()) {
    const contactStr = input.client_contact.trim();
    const emailMatch = contactStr.match(/[\w.+-]+@[\w.-]+\.\w+/);
    const email = emailMatch ? emailMatch[0] : null;
    const namePart = contactStr.replace(/[\w.+-]+@[\w.-]+\.\w+/, "").trim();
    await db().from("mission_contacts").insert({
      mission_id: mission.id,
      first_name: namePart || null,
      email,
      is_primary: true,
      language: "fr",
      position: 0,
    });
  }

  return mission;
}

export async function updateMission(id: string, updates: UpdateMissionInput): Promise<Mission> {
  const result = await db().from("missions").update(updates).eq("id", id).select().single();
  return throwIfError(result) as Mission;
}

export async function deleteMission(id: string): Promise<void> {
  const result = await db().from("missions").delete().eq("id", id);
  throwIfError(result);
}

export async function moveMission(missionId: string, newStatus: MissionStatus, newPosition: number): Promise<void> {
  const result = await db().from("missions").update({ status: newStatus, position: newPosition }).eq("id", missionId);
  throwIfError(result);
}

// ── Activities ───────────────────────────────────────────────────────

export async function fetchActivities(missionId: string): Promise<MissionActivity[]> {
  const result = await db().from("mission_activities").select("*").eq("mission_id", missionId).order("activity_date", { ascending: false });
  return (throwIfError(result) || []) as MissionActivity[];
}

/** Fetch every activity across all missions. Used by the profitability dashboard. */
export async function fetchAllActivities(): Promise<MissionActivity[]> {
  const result = await db()
    .from("mission_activities")
    .select("*")
    .order("activity_date", { ascending: false });
  return (throwIfError(result) || []) as MissionActivity[];
}

/**
 * Returns a Set of mission IDs that have at least one pending scheduled action
 * (duration = 0, is_billed = false) with a future date (strictly after today).
 * Used by the Kanban board to hide missions with only future-dated actions.
 */
export async function fetchMissionIdsWithFutureScheduledActions(): Promise<Set<string>> {
  const today = todayAsISO();
  const result = await db()
    .from("mission_activities")
    .select("mission_id")
    .eq("duration", 0)
    .eq("is_billed", false)
    .gt("activity_date", today);
  const rows = (throwIfError(result) || []) as { mission_id: string }[];
  return new Set(rows.map((r) => r.mission_id));
}

export async function createActivity(input: Omit<MissionActivity, "id" | "created_at" | "updated_at">): Promise<MissionActivity> {
  const result = await db().from("mission_activities").insert(input).select().single();
  return throwIfError(result) as MissionActivity;
}

export async function updateActivity(id: string, updates: Partial<MissionActivity>): Promise<MissionActivity> {
  const result = await db().from("mission_activities").update(updates).eq("id", id).select().single();
  return throwIfError(result) as MissionActivity;
}

export async function deleteActivity(id: string): Promise<void> {
  const result = await db().from("mission_activities").delete().eq("id", id);
  throwIfError(result);
}

// ── Pages ────────────────────────────────────────────────────────────

export async function fetchPages(missionId: string): Promise<MissionPage[]> {
  const result = await db().from("mission_pages").select("*").eq("mission_id", missionId).order("position", { ascending: true });
  return (throwIfError(result) || []) as MissionPage[];
}

export async function createPage(input: { mission_id: string; parent_page_id?: string | null; title?: string; content?: string; activity_id?: string | null; icon?: string }): Promise<MissionPage> {
  const maxPos = await getMaxPosition("mission_pages", {
    mission_id: input.mission_id,
    parent_page_id: input.parent_page_id || null,
  });

  const result = await db()
    .from("mission_pages")
    .insert({
      mission_id: input.mission_id,
      parent_page_id: input.parent_page_id || null,
      title: input.title || "Sans titre",
      content: input.content || null,
      activity_id: input.activity_id || null,
      icon: input.icon || null,
      position: maxPos + 1,
    })
    .select()
    .single();

  return throwIfError(result) as MissionPage;
}

export async function updatePage(id: string, updates: Partial<MissionPage>): Promise<MissionPage> {
  const result = await db().from("mission_pages").update(updates).eq("id", id).select().single();
  return throwIfError(result) as MissionPage;
}

export async function deletePage(id: string): Promise<void> {
  const result = await db().from("mission_pages").delete().eq("id", id);
  throwIfError(result);
}

// ── Page Templates ───────────────────────────────────────────────────

export async function fetchPageTemplates(): Promise<MissionPageTemplate[]> {
  const result = await db().from("mission_page_templates").select("*").order("position", { ascending: true });
  return (throwIfError(result) || []) as MissionPageTemplate[];
}

export async function createPageTemplate(input: { name: string; description?: string; content: string; icon?: string }): Promise<MissionPageTemplate> {
  const maxPos = await getMaxPosition("mission_page_templates");
  const result = await db().from("mission_page_templates").insert({ ...input, position: maxPos + 1 }).select().single();
  return throwIfError(result) as MissionPageTemplate;
}

export async function updatePageTemplate(id: string, updates: Partial<MissionPageTemplate>): Promise<MissionPageTemplate> {
  const result = await db().from("mission_page_templates").update({ ...updates, updated_at: new Date().toISOString() }).eq("id", id).select().single();
  return throwIfError(result) as MissionPageTemplate;
}

export async function deletePageTemplate(id: string): Promise<void> {
  const result = await db().from("mission_page_templates").delete().eq("id", id);
  throwIfError(result);
}

// ── Contacts ─────────────────────────────────────────────────────────

export async function fetchContacts(missionId: string): Promise<MissionContact[]> {
  const result = await db()
    .from("mission_contacts")
    .select("*")
    .eq("mission_id", missionId)
    .order("is_primary", { ascending: false })
    .order("position", { ascending: true });
  return (throwIfError(result) || []) as MissionContact[];
}

export async function createContact(input: { mission_id: string; first_name?: string; last_name?: string; email?: string; phone?: string; role?: string; language?: string; is_primary?: boolean }): Promise<MissionContact> {
  const maxPos = await getMaxPosition("mission_contacts", { mission_id: input.mission_id });

  if (input.is_primary) {
    await db().from("mission_contacts").update({ is_primary: false }).eq("mission_id", input.mission_id);
  }

  const result = await db().from("mission_contacts").insert({ ...input, position: maxPos + 1 }).select().single();
  return throwIfError(result) as MissionContact;
}

export async function updateContact(id: string, missionId: string, updates: Partial<MissionContact>): Promise<MissionContact> {
  if (updates.is_primary) {
    await db().from("mission_contacts").update({ is_primary: false }).eq("mission_id", missionId);
  }
  const result = await db().from("mission_contacts").update({ ...updates, updated_at: new Date().toISOString() }).eq("id", id).select().single();
  return throwIfError(result) as MissionContact;
}

export async function deleteContact(id: string): Promise<void> {
  const result = await db().from("mission_contacts").delete().eq("id", id);
  throwIfError(result);
}

// ── Compile-time contract check ─────────────────────────────────────
({
  fetch: fetchMissions,
  fetchById: fetchMissionById,
  create: createMission,
  update: updateMission,
  remove: deleteMission,
  move: moveMission,
}) satisfies KanbanRepository<Mission, CreateMissionInput, UpdateMissionInput, MissionStatus>;
