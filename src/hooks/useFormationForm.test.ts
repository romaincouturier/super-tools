import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));
vi.mock("@/components/formations/ScheduleEditor", () => ({ SESSION_PRESETS: { full: { start: "09:00", end: "17:00" } } }));
import { useFormationForm } from "./useFormationForm";

describe("Formule de session permanente", () => {
  it("la communauté choisie remplace le lien externe sans changer les supports", () => {
    const { result } = renderHook(() => useFormationForm());
    act(() => {
      result.current.setLmsCourseId("supports-course");
      result.current.setCommunityCourseId("community-course");
      result.current.setPrivateGroupUrl("https://www.linkedin.com/groups/13909349/");
    });
    const payload = result.current.buildTrainingPayload({ isCreate: false });
    expect(payload.community_lms_course_id).toBe("community-course");
    expect(payload.private_group_url).toBeNull();
    expect(payload).not.toHaveProperty("supports_lms_course_id");
  });
  it("la suppression du lien persiste null", () => {
    const { result } = renderHook(() => useFormationForm());
    act(() => result.current.setPrivateGroupUrl(""));
    expect(result.current.buildTrainingPayload({ isCreate: false }).private_group_url).toBeNull();
    expect(result.current.buildTrainingPayload({ isCreate: false }).community_lms_course_id).toBeNull();
  });
  it("conserve la formule sélectionnée et le cours dans la nouvelle session", () => {
    const { result } = renderHook(() => useFormationForm());
    act(() => {
      result.current.setIsPermanent(true);
      result.current.setSelectedFormulaId("solo-id");
      result.current.setLmsCourseId("course-id");
    });
    const payload = result.current.buildTrainingPayload({ isCreate: true });
    // La formule est rattachée via training_formulas : la table trainings n'a pas de colonne formula_id.
    expect(payload).not.toHaveProperty("formula_id");
    expect(result.current.selectedFormulaId).toBe("solo-id");
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