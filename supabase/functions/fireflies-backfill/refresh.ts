import type { FirefliesMeeting } from "../_shared/fireflies-client.ts";

export async function refreshRecentFireflies(
  list: (skip: number, toDate?: string, fromDate?: string, limit?: number) => Promise<FirefliesMeeting[]>,
  readExisting: (ids: string[]) => Promise<Array<{ external_id: string; status: string; raw_text?: string | null }>>,
  importMeeting: (id: string) => Promise<boolean>,
) {
  const meetings = await list(0, undefined, undefined, 30);
  const rows = meetings.length ? await readExisting(meetings.map((meeting) => meeting.id)) : [];
  const existing = new Map(rows.map((row) => [row.external_id, row]));
  const invalid = meetings.filter((meeting) => {
    const row = existing.get(meeting.id);
    return row && row.status !== "trashed" && (row.status === "error" || !row.raw_text?.trim());
  });
  let imported = 0;
  for (const meeting of meetings) {
    if (!existing.has(meeting.id)) {
      if (await importMeeting(meeting.id)) imported++;
      existing.set(meeting.id, { external_id: meeting.id, status: "ready" });
    }
  }
  return { total_listed: meetings.length, newly_imported: imported, invalid_existing: invalid.length };
}