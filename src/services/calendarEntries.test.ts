import { describe, it, expect } from "vitest";
import { unifyCalendarEntries } from "./calendarEntries";

// unifyCalendarEntries is a pure function — no Supabase mock needed

describe("unifyCalendarEntries", () => {
  it("maps trainings to CalendarEntry with type 'formation'", () => {
    const result = unifyCalendarEntries(
      [{ id: "t1", training_name: "React 101", start_date: "2026-03-20", end_date: "2026-03-22", location: "Paris" }],
      [],
      [],
    );
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      id: "t1",
      type: "formation",
      title: "React 101",
      date: "2026-03-20",
      endDate: "2026-03-22",
      location: "Paris",
      path: "/formations/t1",
    });
  });

  it("maps events to CalendarEntry with type 'event'", () => {
    const result = unifyCalendarEntries(
      [],
      [{ id: "e1", title: "Conf", event_date: "2026-04-01", location: "Lyon", status: "active" }],
      [],
    );
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      id: "e1",
      type: "event",
      title: "Conf",
      date: "2026-04-01",
      location: "Lyon",
      path: "/events/e1",
    });
  });

  it("maps live meetings to CalendarEntry with type 'live' and extracts time", () => {
    const result = unifyCalendarEntries(
      [],
      [],
      [{ id: "l1", training_id: "t5", title: "Live Session", scheduled_at: "2026-03-25T14:30:00", duration_minutes: 60, status: "scheduled" }],
    );
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      id: "l1",
      type: "live",
      title: "Live Session",
      date: "2026-03-25",
      time: "14:30",
      path: "/formations/t5",
    });
  });

  it("sorts all entries chronologically by date", () => {
    const result = unifyCalendarEntries(
      [{ id: "t1", training_name: "Late Training", start_date: "2026-04-10", end_date: null, location: null }],
      [{ id: "e1", title: "Early Event", event_date: "2026-03-01", location: null, status: "active" }],
      [{ id: "l1", training_id: "t2", title: "Mid Live", scheduled_at: "2026-03-15T10:00:00", duration_minutes: 30, status: "scheduled" }],
    );
    expect(result).toHaveLength(3);
    expect(result[0].id).toBe("e1");
    expect(result[1].id).toBe("l1");
    expect(result[2].id).toBe("t1");
  });

  it("returns empty array when all inputs are empty", () => {
    expect(unifyCalendarEntries([], [], [])).toEqual([]);
  });

  it("handles training with null end_date and location", () => {
    const result = unifyCalendarEntries(
      [{ id: "t1", training_name: "Solo", start_date: "2026-05-01", end_date: null, location: null }],
      [],
      [],
    );
    expect(result[0].endDate).toBeNull();
    expect(result[0].location).toBeNull();
  });
});
