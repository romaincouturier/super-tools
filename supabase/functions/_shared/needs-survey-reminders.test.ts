import { describe, it, expect } from "vitest";
import { planNeedsSurveyReminderDays } from "./needs-survey-reminders.ts";

describe("planNeedsSurveyReminderDays", () => {
  it("relance à J+3 ouvrés puis la veille de la formation", () => {
    // envoi mercredi 02/12/2026, formation lundi 14/12/2026
    expect(planNeedsSurveyReminderDays({ sentAt: new Date("2026-12-02T10:00:00Z"), sessionStart: "2026-12-14", reminderDelay: 3 }))
      .toEqual(["2026-12-07", "2026-12-11"]);
  });
  it("une seule relance quand J+3 tombe la veille", () => {
    expect(planNeedsSurveyReminderDays({ sentAt: new Date("2026-12-07T10:00:00Z"), sessionStart: "2026-12-11", reminderDelay: 3 }))
      .toEqual(["2026-12-10"]);
  });
  it("pas de relance J+3 après le début de la formation", () => {
    expect(planNeedsSurveyReminderDays({ sentAt: new Date("2026-12-07T10:00:00Z"), sessionStart: "2026-12-09", reminderDelay: 3 }))
      .toEqual(["2026-12-08"]);
  });
  it("aucune relance si la formation commence le lendemain", () => {
    expect(planNeedsSurveyReminderDays({ sentAt: new Date("2026-12-07T10:00:00Z"), sessionStart: "2026-12-08", reminderDelay: 3 }))
      .toEqual([]);
  });
  it("sans date de formation : seulement J+3", () => {
    expect(planNeedsSurveyReminderDays({ sentAt: new Date("2026-12-02T10:00:00Z"), sessionStart: null, reminderDelay: 3 }))
      .toEqual(["2026-12-07"]);
  });
});
