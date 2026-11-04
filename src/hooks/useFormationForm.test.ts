import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));
vi.mock("@/components/formations/ScheduleEditor", () => ({ SESSION_PRESETS: { full: { start: "09:00", end: "17:00" } } }));
import { useFormationForm } from "./useFormationForm";

describe("Formule de session permanente", () => {
  it("conserve la formule sélectionnée et le cours dans la nouvelle session", () => {
    const { result } = renderHook(() => useFormationForm());
    act(() => {
      result.current.setIsPermanent(true);
      result.current.setSelectedFormulaId("solo-id");
      result.current.setLmsCourseId("course-id");
    });
    const payload = result.current.buildTrainingPayload({ isCreate: true });
    expect(payload.formula_id).toBe("solo-id");
    expect(payload.supports_lms_course_id).toBe("course-id");
    expect(payload.session_format).toBe("distanciel_asynchrone");
  });
  it("ne change pas la formule des sessions classiques ou en modification", () => {
    const { result } = renderHook(() => useFormationForm());
    act(() => result.current.setSelectedFormulaId("solo-id"));
    expect(result.current.buildTrainingPayload({ isCreate: true })).not.toHaveProperty("formula_id");
    act(() => result.current.setIsPermanent(true));
    expect(result.current.buildTrainingPayload({ isCreate: false })).not.toHaveProperty("formula_id");
  });
});