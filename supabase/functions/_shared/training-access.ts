export interface AccessTraining {
  id?: string;
  training_name?: string;
  venue_id?: string | null;
  location?: string | null;
  access_instructions?: string | null;
  session_format?: string | null;
  format_formation?: string | null;
  start_date?: string | null;
  is_cancelled?: boolean | null;
  assigned_to?: string | null;
}

export interface AccessVenue {
  id: string;
  name: string;
  address: string;
  postal_code: string;
  city: string;
  access_instructions?: string | null;
}

export function isPhysicalTraining(training: AccessTraining): boolean {
  if (training.session_format) return training.session_format === "presentiel";
  return ["intra", "inter-entreprises", "presentiel"].includes(training.format_formation || "");
}

export function resolveTrainingAccess(training: AccessTraining, venues: AccessVenue[]): string {
  if (!isPhysicalTraining(training)) return "";
  if (training.access_instructions?.trim()) return training.access_instructions.trim();
  const matches = training.venue_id
    ? venues.filter(v => v.id === training.venue_id)
    : venues.filter(v => [v.name, v.address, [v.postal_code, v.city].filter(Boolean).join(" ")].filter(Boolean).join(", ") === training.location);
  return matches.length === 1 ? matches[0].access_instructions?.trim() || "" : "";
}

export async function fetchAccessVenues(db: any): Promise<AccessVenue[]> {
  const { data, error } = await db.from("training_venues").select("id, name, address, postal_code, city, access_instructions");
  if (error) throw error;
  return data || [];
}

export function accessInstructionsHtml(instructions: string): string {
  if (!instructions.trim()) return "";
  const escaped = instructions.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  return `<p><strong>Instructions d'accès</strong><br>${escaped.replace(/\r?\n/g, "<br>")}</p>`;
}

export function includeAccessInstructions(html: string, instructions: string): string {
  const block = accessInstructionsHtml(instructions);
  if (!block) return html;
  const listEnd = html.indexOf("</ul>");
  return listEnd >= 0 ? html.slice(0, listEnd + 5) + block + html.slice(listEnd + 5) : html + block;
}

export function findMissingTrainingAccess(trainings: AccessTraining[], venues: AccessVenue[], today: string): AccessTraining[] {
  const boundary = new Date(`${today}T12:00:00Z`);
  boundary.setUTCDate(boundary.getUTCDate() + 7);
  const end = boundary.toISOString().slice(0, 10);
  return trainings.filter(t => !t.is_cancelled && t.start_date && t.start_date >= today && t.start_date < end && isPhysicalTraining(t) && !resolveTrainingAccess(t, venues));
}

export async function fetchMissingTrainingAccess(db: any, today: string): Promise<AccessTraining[]> {
  const [venues, result] = await Promise.all([
    fetchAccessVenues(db),
    db.from("trainings").select("id, training_name, venue_id, location, access_instructions, session_format, format_formation, start_date, is_cancelled, assigned_to").gte("start_date", today),
  ]);
  if (result.error) throw result.error;
  return findMissingTrainingAccess(result.data || [], venues, today);
}