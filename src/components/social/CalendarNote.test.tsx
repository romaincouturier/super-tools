import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { DndContext } from "@dnd-kit/core";
import CalendarNote from "./CalendarNote";
import { maskText } from "@/lib/demoMask";
import type { SocialCalendarNote } from "@/services/socialContents";

const h = vi.hoisted(() => ({ demo: false }));
vi.mock("@/contexts/DemoModeContext", () => ({ useDemoMode: () => ({ isDemoMode: h.demo }) }));

const NOTE: SocialCalendarNote = { id: "n1", day: "2026-11-12", text: "Relance Acme Formation", color: "#f97316", created_at: "" };

const renderNote = (onOpen = vi.fn()) => {
  render(<DndContext><CalendarNote note={NOTE} onOpen={onOpen} /></DndContext>);
  return onOpen;
};

describe("CalendarNote", () => {
  beforeEach(() => { h.demo = false; });

  it("affiche le texte et ouvre la note au clic", () => {
    const onOpen = renderNote();
    const el = screen.getByTestId("social-note-n1");
    expect(el).toHaveTextContent("Relance Acme Formation");
    expect(el).toHaveAttribute("aria-label", "Note : Relance Acme Formation");
    fireEvent.click(el);
    expect(onOpen).toHaveBeenCalledWith(NOTE);
  });

  it("masque le texte et l'aria-label en mode démo, sans trace du texte original", () => {
    h.demo = true;
    renderNote();
    const el = screen.getByTestId("social-note-n1");
    expect(el).toHaveTextContent(maskText(NOTE.text));
    expect(el).toHaveAttribute("aria-label", `Note : ${maskText(NOTE.text)}`);
    expect(el.outerHTML).not.toContain("Acme");
    expect(el.outerHTML).not.toContain("Relance");
  });
});
