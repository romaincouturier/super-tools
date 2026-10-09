import { it, expect } from "vitest";
import { claimLiveReminder } from "./live-reminder-claim.ts";

function fakeSupabase() {
  const rows = new Set<string>();
  return {
    from: () => ({
      upsert: (row: { live_meeting_id: string; participant_id: string }) => ({
        select: () => {
          const k = `${row.live_meeting_id}:${row.participant_id}`;
          if (rows.has(k)) return Promise.resolve({ data: [], error: null });
          rows.add(k);
          return Promise.resolve({ data: [row], error: null });
        },
      }),
    }),
  };
}

it("un seul déclencheur obtient l'envoi pour (live, participant)", async () => {
  const sb = fakeSupabase();
  expect(await claimLiveReminder(sb, "live1", "p1", "scheduled_emails")).toEqual(true);
  expect(await claimLiveReminder(sb, "live1", "p1", "process-live-reminders")).toEqual(false);
  expect(await claimLiveReminder(sb, "live1", "p2", "process-live-reminders")).toEqual(true);
});
