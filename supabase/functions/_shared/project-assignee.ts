export interface ProjectAssignee {
  user_id: string;
  display_name?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  email?: string | null;
  is_admin?: boolean;
}

export function normalizeAssignee(value: string | null | undefined): string {
  return (value || "").trim().replace(/\s+/g, " ").toLowerCase();
}

export function canonicalAssignee(user: ProjectAssignee): string {
  return [user.display_name, [user.first_name, user.last_name].filter(Boolean).join(" "), user.email]
    .map((value) => (value || "").trim().replace(/\s+/g, " "))
    .find(Boolean) || "";
}

export function resolveProjectAssignee(value: string | null | undefined, users: ProjectAssignee[]): ProjectAssignee | null {
  const needle = normalizeAssignee(value);
  if (!needle) return null;
  const matches = users.filter((user) => [user.display_name, [user.first_name, user.last_name].filter(Boolean).join(" "), user.email]
    .some((alias) => normalizeAssignee(alias) === needle));
  return matches.length === 1 ? matches[0] : null;
}

export async function loadProjectAssignees(supabase: any): Promise<ProjectAssignee[]> {
  const { data, error } = await supabase.from("profiles")
    .select("user_id, display_name, first_name, last_name, email, is_admin");
  if (error) throw new Error(`Impossible de résoudre les assignés : ${error.message}`);
  return data || [];
}

export async function requireCanonicalAssignee(supabase: any, value: unknown): Promise<string | null> {
  if (value === null || value === undefined || String(value).trim() === "") return null;
  const user = resolveProjectAssignee(String(value), await loadProjectAssignees(supabase));
  if (!user) throw new Error(`Assigné inconnu ou ambigu : « ${String(value).trim()} ». Utilisez le nom affiché, prénom nom ou email d'un utilisateur existant.`);
  return canonicalAssignee(user);
}

export function projectAssignmentTargets(
  action: { id: string; user_id: string; assigned_to?: string | null },
  users: ProjectAssignee[],
): { assignedTo: string | null; targetUserIds: string[]; assignmentWarning: string | null } {
  const value = action.assigned_to?.trim();
  if (!value) return { assignedTo: action.user_id, targetUserIds: [action.user_id], assignmentWarning: null };
  const user = resolveProjectAssignee(value, users);
  if (user) return { assignedTo: user.user_id, targetUserIds: [user.user_id], assignmentWarning: null };
  const assignmentWarning = `assigné inconnu : ${value}`;
  console.warn(`[supertilt_actions:${action.id}] ${assignmentWarning}`);
  return {
    assignedTo: null,
    targetUserIds: [...new Set([action.user_id, ...users.filter((u) => u.is_admin).map((u) => u.user_id)])],
    assignmentWarning,
  };
}