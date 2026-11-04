/**
 * Outils MCP des tableaux projets (Projets transverses / Projets supertilt.fr) :
 * lecture du board, création et mise à jour des actions (supertilt_actions).
 */
import type { AuditFn, Supabase } from "./mission-tools.ts";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const BOARDS = ["transverse", "site"] as const;
type Board = (typeof BOARDS)[number];

const ACTION_COLUMNS =
  "id, board, column_id, position, title, description, assigned_to, deadline, is_completed, completed_at, mission_id, user_id, updated_at";

function checkBoard(board: unknown): Board {
  const b = String(board || "").trim();
  if (!BOARDS.includes(b as Board)) {
    throw new Error(`board doit valoir : ${BOARDS.join(", ")} (transverse = Projets transverses, site = Projets supertilt.fr)`);
  }
  return b as Board;
}

async function findColumn(
  supabase: Supabase,
  board: Board,
  column: unknown,
): Promise<{ id: string; name: string }> {
  const { data: columns } = await (supabase as any)
    .from("supertilt_columns")
    .select("id, name, position")
    .eq("board", board)
    .order("position", { ascending: true });
  const list = (columns || []) as { id: string; name: string }[];
  if (list.length === 0) throw new Error(`Aucune colonne sur le board ${board}`);
  const valid = list.map((c) => c.name).join(", ");
  if (column === undefined || column === null || String(column).trim() === "") {
    return list[0]; // première colonne par défaut
  }
  const needle = String(column).trim();
  const exact = list.filter((c) => c.id === needle || c.name.toLowerCase() === needle.toLowerCase());
  const matches = exact.length > 0
    ? exact
    : list.filter((c) => c.name.toLowerCase().includes(needle.toLowerCase()));
  if (matches.length === 0) throw new Error(`Colonne inconnue « ${needle} ». Colonnes valides : ${valid}`);
  if (matches.length > 1) throw new Error(`Colonne ambiguë « ${needle} » : ${matches.map((c) => c.name).join(", ")}`);
  return matches[0];
}

export async function listProjectBoard(supabase: Supabase, board: unknown): Promise<string> {
  const boards: Board[] = board ? [checkBoard(board)] : [...BOARDS];
  const result: Record<string, unknown> = {};
  for (const b of boards) {
    const { data: columns } = await (supabase as any)
      .from("supertilt_columns")
      .select("id, name, position")
      .eq("board", b)
      .order("position", { ascending: true });
    const { data: actions } = await (supabase as any)
      .from("supertilt_actions")
      .select(ACTION_COLUMNS)
      .eq("board", b)
      .order("position", { ascending: true });
    const colName = new Map((columns || []).map((c: any) => [c.id, c.name]));
    result[b] = {
      columns: (columns || []).map((c: any) => ({ id: c.id, name: c.name })),
      actions: (actions || []).map((a: any) => ({
        id: a.id,
        title: a.title,
        column: colName.get(a.column_id) ?? null,
        column_id: a.column_id,
        assigned_to: a.assigned_to,
        deadline: a.deadline,
        is_completed: a.is_completed,
        description: a.description,
        mission_id: a.mission_id,
      })),
    };
  }
  return JSON.stringify(result);
}

export async function createProjectAction(
  supabase: Supabase,
  input: Record<string, unknown>,
  audit: AuditFn,
): Promise<string> {
  const board = checkBoard(input.board);
  const title = String(input.title ?? "").trim();
  if (!title) throw new Error("title ne peut pas être vide");
  const column = await findColumn(supabase, board, input.column);
  if (input.deadline !== undefined && input.deadline !== null && !DATE_RE.test(String(input.deadline))) {
    throw new Error("deadline doit être au format YYYY-MM-DD");
  }

  const { data: last } = await (supabase as any)
    .from("supertilt_actions")
    .select("position")
    .eq("column_id", column.id)
    .order("position", { ascending: false })
    .limit(1);
  const position = ((last?.[0]?.position as number | undefined) ?? -1) + 1;

  await audit(`create_project_action [${board}] « ${title} » → ${column.name}`);
  const { data: created, error } = await (supabase as any)
    .from("supertilt_actions")
    .insert({
      board,
      title,
      description: input.description ? String(input.description).trim() : null,
      assigned_to: input.assigned_to ? String(input.assigned_to).trim() : null,
      deadline: input.deadline ?? null,
      column_id: column.id,
      position,
    })
    .select(ACTION_COLUMNS)
    .single();
  if (error) throw new Error(error.message);
  return JSON.stringify({ saved: true, action: created });
}

export async function updateProjectAction(
  supabase: Supabase,
  actionId: string,
  input: Record<string, unknown>,
  audit: AuditFn,
): Promise<string> {
  const id = (actionId || "").trim();
  if (!UUID_RE.test(id)) throw new Error("action_id doit être un UUID");

  const { data: existing } = await (supabase as any)
    .from("supertilt_actions")
    .select(ACTION_COLUMNS)
    .eq("id", id)
    .maybeSingle();
  if (!existing) throw new Error("Action introuvable");

  const patch: Record<string, unknown> = {};
  if (input.title !== undefined) {
    const t = String(input.title ?? "").trim();
    if (!t) throw new Error("title ne peut pas être vide");
    patch.title = t;
  }
  for (const k of ["description", "assigned_to"] as const) {
    if (input[k] === undefined) continue;
    patch[k] = input[k] === null ? null : String(input[k]).trim() || null;
  }
  if (input.deadline !== undefined) {
    if (input.deadline !== null && !DATE_RE.test(String(input.deadline))) {
      throw new Error("deadline doit être au format YYYY-MM-DD ou null");
    }
    patch.deadline = input.deadline;
  }
  if (input.is_completed !== undefined) {
    const done = input.is_completed === true;
    patch.is_completed = done;
    patch.completed_at = done ? new Date().toISOString() : null;
  }
  if (input.column !== undefined) {
    const column = await findColumn(supabase, existing.board as Board, input.column);
    patch.column_id = column.id;
  }
  const unknown = Object.keys(input).filter((k) => !(k in patch) && input[k] !== undefined);
  if (unknown.length) throw new Error(`Champs non modifiables : ${unknown.join(", ")}`);
  if (Object.keys(patch).length === 0) throw new Error("Aucun champ à modifier");

  await audit(`update_project_action ${id}: ${Object.keys(patch).join(", ")}`);
  const { data: updated, error } = await (supabase as any)
    .from("supertilt_actions")
    .update(patch)
    .eq("id", id)
    .select(ACTION_COLUMNS)
    .single();
  if (error) throw new Error(error.message);

  return JSON.stringify({
    saved: true,
    before: existing,
    action: updated,
    hint: "Seuls les champs fournis ont été modifiés. L'action ne peut pas être supprimée depuis ici.",
  });
}
